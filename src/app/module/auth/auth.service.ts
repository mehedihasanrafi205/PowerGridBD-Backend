import bcrypt from "bcryptjs";
import crypto from "crypto";
import path from "path";
import ejs from "ejs";
import httpStatus from "http-status";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import type { TokenPayload } from "google-auth-library";

import config from "../../config";
import { prisma } from "../../lib/prisma";

import { jwtUtils } from "../../utils/jwt";
import { AppError } from "../../utils/AppError";
import type {
  IForgotPasswordPayload,
  IGoogleLoginPayload,
  ILoginUserPayload,
  IRegisterCustomerPayload,
  IRequestUser,
  IResetPasswordPayload,
  IVerifyEmailPayload,
} from "./auth.interface";
import { redisClient } from "../../lib/redis";
import { transporter } from "../../lib/nodemailer";
import { sendTemplatedEmail } from "../../utils/notify";
import {
  AuthProvider,
  UserRole,
  UserStatus,
} from "../../../generated/prisma/enums";
import { googleClient } from "../../lib/googleAuth";

const registerCustomer = async (payload: IRegisterCustomerPayload) => {
  const { name, password, phone, address, areaId } = payload;
  const email = payload.email.trim().toLowerCase();

  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExists) {
    throw new AppError(
      httpStatus.CONFLICT,
      "User with this email already exists",
    );
  }

  const hashedPassword = await bcrypt.hash(
    password,
    Number(config.bcrypt_salt_rounds),
  );

  const otpKey = `customer-registration-otp:${email}`;
  const otpValue = crypto.randomInt(100000, 1000000).toString();
  const expirationSeconds = 60 * 15; // 15 minutes

  await redisClient.set(otpKey, otpValue, {
    expiration: { type: "EX", value: expirationSeconds },
  });

  const registrationDataKey = `customer-registration-data:${email}`;
  const redisUserData = {
    name,
    email,
    password: hashedPassword,
    phone,
    address,
    areaId,
  };

  await redisClient.set(registrationDataKey, JSON.stringify(redisUserData), {
    expiration: { type: "EX", value: expirationSeconds },
  });

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/registration-user-otp.ejs",
  );
  const templateData = {
    name,
    email,
    otp: otpValue,
    expirationMinutes: expirationSeconds / 60,
    year: new Date().getFullYear(),
  };
  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.email_sender,
    to: email,
    subject: "Email Verification OTP - PowerGridBD",
    html,
  });
};

const verifyCustomerEmail = async (payload: IVerifyEmailPayload) => {
  const { otp } = payload;
  const email = payload.email.trim().toLowerCase();

  const otpKey = `customer-registration-otp:${email}`;
  const redisOtp = await redisClient.get(otpKey);

  if (!redisOtp) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid or expired OTP");
  }

  if (redisOtp !== otp) {
    throw new AppError(httpStatus.UNAUTHORIZED, "OTP does not match");
  }

  await redisClient.del(otpKey);

  const registrationDataKey = `customer-registration-data:${email}`;
  const redisData = await redisClient.get(registrationDataKey);

  if (!redisData) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Registration data not found or expired",
    );
  }

  const customerPayload: IRegisterCustomerPayload = JSON.parse(redisData);

  const createdUser = await prisma.user.create({
    data: {
      name: customerPayload.name,
      email: customerPayload.email,
      password: customerPayload.password,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      phone: customerPayload.phone || null,
      address: customerPayload.address || null,
      areaId: customerPayload.areaId || null,
    },
    omit: { password: true },
  });

  await redisClient.del(registrationDataKey);

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/welcome-email.ejs",
  );

  const templateData = {
    name: createdUser.name,
    email: createdUser.email,
    year: new Date().getFullYear(),
  };

  // Best-effort: the account already exists at this point, so a mail
  // failure must never fail email verification.
  try {
    const html = await ejs.renderFile(templatePath, templateData);

    await transporter.sendMail({
      from: config.email_sender,
      to: createdUser.email,
      subject: "Welcome to PowerGridBD - Account Created Successfully",
      html,
    });
  } catch (emailError) {
    console.error(
      "Failed to send welcome email after email verification:",
      emailError,
    );
  }

  const jwtPayload = {
    userId: createdUser.id,
    name: createdUser.name,
    email: createdUser.email,
    role: createdUser.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    user: createdUser,
    accessToken,
    refreshToken,
  };
};

const loginUser = async (payload: ILoginUserPayload) => {
  const { password } = payload;
  const email = payload.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.status === UserStatus.BLOCKED) {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }

  if (user.isDeleted || user.status === UserStatus.DELETED) {
    throw new AppError(httpStatus.GONE, "User is deleted");
  }

  if (!user.password && user.googleId) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Account registered with Google. Please log in using Google.",
    );
  }

  const isPasswordMatched = await bcrypt.compare(
    password,
    user.password as string,
  );

  if (!isPasswordMatched) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken,
  };
};

const getMe = async (user: IRequestUser) => {
  const isUserExists = await prisma.user.findUnique({
    where: { id: user.userId },
    // include: { area: true },
    omit: { password: true },
  });

  if (!isUserExists) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return isUserExists;
};

const refreshToken = async (token: string) => {
  const verifiedRefreshToken = jwtUtils.verifyToken(
    token,
    config.jwt_refresh_secret,
  );

  if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      config.node_env === "development"
        ? verifiedRefreshToken.error
        : "Invalid refresh token",
    );
  }

  const data = verifiedRefreshToken.data as JwtPayload;

  const user = await prisma.user.findUnique({
    where: { id: data.userId },
  });

  if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User is inactive or not found",
    );
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const newRefreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
  let googleIdTokenPayload: TokenPayload | null | undefined = null;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: payload.idToken,
      audience: config.google_client_id,
    });
    googleIdTokenPayload = ticket.getPayload();
  } catch (error) {
    if (config.node_env === "development") {
      console.error("Google ID token verification failed", error);
    }
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Invalid or expired Google ID Token",
    );
  }

  if (!googleIdTokenPayload?.email || !googleIdTokenPayload?.name) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid Google account information",
    );
  }

  let user = await prisma.user.findUnique({
    where: { email: googleIdTokenPayload.email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: googleIdTokenPayload.name,
        email: googleIdTokenPayload.email,
        role: UserRole.CUSTOMER,
        googleId: googleIdTokenPayload.sub,
        authProvider: AuthProvider.GOOGLE,
        emailVerified: true,
      },
    });

    try {
      const templatePath = path.join(
        process.cwd(),
        "src/app/templates/welcome-email.ejs",
      );

      const templateData = {
        name: user.name,
        email: user.email,
        year: new Date().getFullYear(),
      };

      const html = await ejs.renderFile(templatePath, templateData);

      await transporter.sendMail({
        from: config.email_sender,
        to: user.email,
        subject: "Welcome to PowerGridBD - Account Created Successfully",
        html,
      });
    } catch (emailError) {
      console.error(
        "Failed to send welcome email via Google login:",
        emailError,
      );
    }
  }

  if (user.status === UserStatus.BLOCKED || user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "Account is blocked or deleted");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return { accessToken, refreshToken };
};

const forgotPassword = async (payload: IForgotPasswordPayload) => {
  const { email } = payload;
  const user = await prisma.user.findUnique({ where: { email } });

  // Always respond successfully to avoid leaking account existence.
  // An OTP email is only sent when the account actually exists.
  if (!user) {
    return;
  }

  const otp = crypto.randomInt(100000, 1000000).toString();
  const key = `forgot-password-otp:${email}`;
  const expirationSeconds = 60 * 15; // 15 minutes

  await redisClient.set(key, otp, {
    expiration: { type: "EX", value: expirationSeconds },
  });

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/forgot-password.ejs",
  );
  const templateData = {
    name: user.name,
    otp,
    expirationMinutes: expirationSeconds / 60,
    year: new Date().getFullYear(),
  };
  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.email_sender,
    to: email,
    subject: "Password Reset OTP - PowerGridBD",
    html,
  });
};

const resetPassword = async (payload: IResetPasswordPayload) => {
  const { email, otp, newPassword } = payload;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const key = `forgot-password-otp:${email}`;
  const redisOtp = await redisClient.get(key);

  if (!redisOtp || redisOtp !== otp) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid or expired OTP");
  }

  const hashedPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  await prisma.user.update({
    where: { email },
    data: { password: hashedPassword },
  });

  await redisClient.del(key);

  await sendTemplatedEmail(
    email,
    "Password Changed Successfully - PowerGridBD",
    "reset-password-success.ejs",
    { name: user.name },
  );
};

};

const logout = async (payload: ILogoutPayload) => {
  const { refreshToken } = payload;
  
  // Add the refresh token to the blacklist (in Redis)
  if (refreshToken) {
    await redisClient.set(`blacklisted-refresh-token:${refreshToken}`, "true", {
      expiration: { type: "EX", value: 60 * 60 * 24 * 7 }, // 7 days
    });
  }
  
  return { success: true, message: "Logged out successfully" };
};

export const AuthService = {
  registerCustomer,
  verifyCustomerEmail,
  loginUser,
  getMe,
  refreshToken,
  googleLogin,
  forgotPassword,
  resetPassword,
  logout,
};
