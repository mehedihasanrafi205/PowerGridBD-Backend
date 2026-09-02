import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import { AuthProvider, UserRole, UserStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { googleAuthClient } from "../../lib/googleAuth";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { jwtUtils } from "../../utils/jwt";
import { generateOtp, storeJson, storeOtp, takeJson, verifyOtp } from "../../utils/otp";
import { sendTemplateEmail } from "../../utils/sendEmail";
import type {
	IForgotPasswordPayload,
	IGoogleLoginPayload,
	ILoginPayload,
	IRegisterPayload,
	IResetPasswordPayload,
	IVerifyEmailPayload,
} from "./auth.interface";

const issueTokens = (user: { id: string; name: string; email: string; role: UserRole }) => {
	const payload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		payload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);
	const refreshToken = jwtUtils.createToken(
		payload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return { accessToken, refreshToken, payload };
};

const register = async (payload: IRegisterPayload) => {
	const email = payload.email.trim().toLowerCase();

	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing?.emailVerified) {
		throw new AppError(httpStatus.CONFLICT, "A verified account with this email already exists");
	}

	const otp = generateOtp();
	await storeOtp(email, otp);
	await storeJson(email, { name: payload.name, email, password: payload.password });

	try {
		await sendTemplateEmail("registration-otp.ejs", email, "PowerGridBD - Verify your email", {
			name: payload.name,
			otp,
		});
	} catch (err) {
		console.error("Failed to send OTP email:", (err as Error).message);
	}

	return { message: "Verification code sent to your email" };
};

const verifyEmail = async (payload: IVerifyEmailPayload) => {
	const email = payload.email.trim().toLowerCase();

	const valid = await verifyOtp(email, payload.otp);
	if (!valid) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
	}

	const pending = await takeJson<IRegisterPayload>(email);
	if (!pending) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Pending registration not found. Please register again.",
		);
	}

	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing?.emailVerified) {
		throw new AppError(httpStatus.CONFLICT, "A verified account with this email already exists");
	}

	const hashedPassword = await bcrypt.hash(pending.password, config.bcrypt_salt_rounds);

	const user = existing
		? await prisma.user.update({
				where: { email },
				data: { name: pending.name, password: hashedPassword, emailVerified: true },
				omit: { password: true },
			})
		: await prisma.user.create({
				data: {
					name: pending.name,
					email,
					password: hashedPassword,
					emailVerified: true,
					role: UserRole.CUSTOMER,
				},
				omit: { password: true },
			});

	const tokens = issueTokens(user);
	return { user, ...tokens };
};

const login = async (payload: ILoginPayload) => {
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({ where: { email } });
	if (!user || !user.password) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}
	if (user.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "Your account is blocked");
	}
	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}
	if (!user.emailVerified) {
		throw new AppError(httpStatus.FORBIDDEN, "Please verify your email before logging in");
	}

	const matched = await bcrypt.compare(payload.password, user.password);
	if (!matched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
	}

	return issueTokens(user);
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
	if (!googleAuthClient) {
		throw new AppError(httpStatus.SERVICE_UNAVAILABLE, "Google login is not configured");
	}

	const ticket = await googleAuthClient.verifyIdToken({
		idToken: payload.idToken,
		audience: config.google_client_id,
	});
	const googlePayload = ticket.getPayload();
	if (!googlePayload?.email) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid Google token");
	}

	const email = googlePayload.email.toLowerCase();
	let user = await prisma.user.findUnique({ where: { email } });

	if (!user) {
		user = await prisma.user.create({
			data: {
				name: googlePayload.name || email,
				email,
				authProvider: AuthProvider.GOOGLE,
				googleId: googlePayload.sub,
				emailVerified: true,
				role: UserRole.CUSTOMER,
			},
			omit: { password: true },
		});
	} else {
		if (!user.googleId) {
			user = await prisma.user.update({
				where: { email },
				data: {
					googleId: googlePayload.sub,
					authProvider: AuthProvider.GOOGLE,
					emailVerified: true,
				},
				omit: { password: true },
			});
		}
	}

	return { user, ...issueTokens(user) };
};

const getMe = async (userId: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		omit: { password: true },
	});
	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}
	return user;
};

const refreshToken = async (token: string) => {
	const verified = jwtUtils.verifyToken(token, config.jwt_refresh_secret);
	if (!verified.success || !verified.data) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			config.node_env === "development" ? verified.error : "Invalid refresh token",
		);
	}

	const data = verified.data as JwtPayload;
	const user = await prisma.user.findUnique({ where: { id: data.userId } });
	if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
		throw new AppError(httpStatus.UNAUTHORIZED, "User is inactive or not found");
	}

	return issueTokens(user);
};

const forgotPassword = async (payload: IForgotPasswordPayload) => {
	const email = payload.email.trim().toLowerCase();
	const user = await prisma.user.findUnique({ where: { email } });
	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	const otp = generateOtp();
	await storeOtp(`reset:${email}`, otp);
	await sendTemplateEmail("forgot-password.ejs", email, "PowerGridBD - Password Reset", {
		name: user.name,
		otp,
	});

	return { message: "Password reset code sent to your email" };
};

const resetPassword = async (payload: IResetPasswordPayload) => {
	const email = payload.email.trim().toLowerCase();
	const valid = await verifyOtp(`reset:${email}`, payload.otp);
	if (!valid) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
	}

	const hashedPassword = await bcrypt.hash(payload.newPassword, config.bcrypt_salt_rounds);
	await prisma.user.update({
		where: { email },
		data: { password: hashedPassword },
	});

	return { message: "Password reset successfully" };
};

export const AuthService = {
	register,
	verifyEmail,
	login,
	googleLogin,
	getMe,
	refreshToken,
	forgotPassword,
	resetPassword,
};
