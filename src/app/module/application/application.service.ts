import bcrypt from "bcryptjs";
import crypto from "crypto";
import path from "path";
import ejs from "ejs";
import httpStatus from "http-status";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { transporter } from "../../lib/nodemailer";
import { AppError } from "../../utils/AppError";
import { logAudit } from "../../utils/audit";
import type { IQuery } from "../../interfaces";
import { calculatePagination, buildMeta } from "../../utils/pagination";
import { subHours } from "date-fns";
import {
  ApplicationStatus,
  UserRole,
  UserStatus,
} from "../../../generated/prisma/enums";
import type {
  IApplyTechnicianPayload,
  IReviewApplicationPayload,
  IVerifyApplicationEmailPayload,
} from "./application.interface";

const OTP_TTL_SECONDS = 60 * 15; // 15 minutes

const otpKeyFor = (email: string) => `technician-application-otp:${email}`;

const sendApplicationOtp = async (name: string, email: string) => {
  const otpValue = crypto.randomInt(100000, 1000000).toString();

  await redisClient.set(otpKeyFor(email), otpValue, {
    expiration: { type: "EX", value: OTP_TTL_SECONDS },
  });

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/technician-application-otp.ejs",
  );
  const html = await ejs.renderFile(templatePath, {
    name,
    email,
    otp: otpValue,
    expirationMinutes: OTP_TTL_SECONDS / 60,
    year: new Date().getFullYear(),
  });

  await transporter.sendMail({
    from: config.email_sender,
    to: email,
    subject: "Technician Application - Email Verification - PowerGridBD",
    html,
  });
};

const applyAsTechnician = async (payload: IApplyTechnicianPayload) => {
  const email = payload.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError(
      httpStatus.CONFLICT,
      "A user account already exists with this email",
    );
  }

  const existingPending = await prisma.technicianApplication.findFirst({
    where: { email, status: ApplicationStatus.PENDING },
  });
  if (existingPending) {
    throw new AppError(
      httpStatus.CONFLICT,
      "A pending application already exists for this email. Please verify it or wait for review.",
    );
  }

  const application = await prisma.technicianApplication.create({
    data: {
      name: payload.name,
      email,
      phone: payload.phone,
      address: payload.address,
      experience: payload.experience,
      bio: payload.bio,
    },
  });

  try {
    await sendApplicationOtp(payload.name, email);
  } catch (emailError) {
    // Roll back so the applicant can retry cleanly with a resend-safe state.
    await prisma.technicianApplication.delete({
      where: { id: application.id },
    });
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "Failed to send verification email. Please try again.",
    );
  }

  return application;
};

const resendApplicationOtp = async (email: string) => {
  const normalized = email.trim().toLowerCase();

  const application = await prisma.technicianApplication.findFirst({
    where: { email: normalized, status: ApplicationStatus.PENDING },
    orderBy: { createdAt: "desc" },
  });

  if (!application) {
    throw new AppError(httpStatus.NOT_FOUND, "Pending application not found");
  }

  if (application.emailVerified) {
    throw new AppError(httpStatus.BAD_REQUEST, "Email is already verified");
  }

  await sendApplicationOtp(application.name, normalized);

  return { email: normalized };
};

const verifyApplicationEmail = async (
  payload: IVerifyApplicationEmailPayload,
) => {
  const email = payload.email.trim().toLowerCase();

  const application = await prisma.technicianApplication.findFirst({
    where: { email, status: ApplicationStatus.PENDING },
    orderBy: { createdAt: "desc" },
  });

  if (!application) {
    throw new AppError(httpStatus.NOT_FOUND, "Pending application not found");
  }

  if (application.emailVerified) {
    throw new AppError(httpStatus.BAD_REQUEST, "Email is already verified");
  }

  const redisOtp = await redisClient.get(otpKeyFor(email));
  if (!redisOtp) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "OTP expired. Please request a new one.",
    );
  }

  if (redisOtp !== payload.otp) {
    throw new AppError(httpStatus.UNAUTHORIZED, "OTP does not match");
  }

  await redisClient.del(otpKeyFor(email));

  const verified = await prisma.technicianApplication.update({
    where: { id: application.id },
    data: { emailVerified: true },
  });

  return verified;
};

const sendDecisionEmail = async (
  application: { name: string; email: string },
  approved: boolean,
  rejectionReason?: string,
  tempPassword?: string,
) => {
  try {
    const templatePath = path.join(
      process.cwd(),
      "src/app/templates/application-decision.ejs",
    );
    const html = await ejs.renderFile(templatePath, {
      name: application.name,
      approved,
      rejectionReason:
        rejectionReason ?? "Requirements did not match our current needs.",
      tempPassword: tempPassword ?? "",
      year: new Date().getFullYear(),
    });

    await transporter.sendMail({
      from: config.email_sender,
      to: application.email,
      subject: approved
        ? "Technician Application Approved - PowerGridBD"
        : "Technician Application Update - PowerGridBD",
      html,
    });
  } catch (emailError) {
    console.error("Failed to send application decision email:", emailError);
  }
};

const reviewApplication = async (
  payload: IReviewApplicationPayload,
  reviewerId: string,
) => {
  const application = await prisma.technicianApplication.findUnique({
    where: { id: payload.applicationId },
  });

  if (!application) {
    throw new AppError(httpStatus.NOT_FOUND, "Application not found");
  }

  if (application.status !== ApplicationStatus.PENDING) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Application has already been ${application.status.toLowerCase()}`,
    );
  }

  if (!application.emailVerified) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Applicant has not verified their email yet",
    );
  }

  if (payload.status === ApplicationStatus.APPROVED) {
    const existingUser = await prisma.user.findUnique({
      where: { email: application.email },
    });
    if (existingUser) {
      throw new AppError(
        httpStatus.CONFLICT,
        "A user account already exists with this email",
      );
    }

    const tempPassword = crypto.randomBytes(9).toString("base64url");
    const hashedPassword = await bcrypt.hash(
      tempPassword,
      Number(config.bcrypt_salt_rounds),
    );

    const user = await prisma.user.create({
      data: {
        name: application.name,
        email: application.email,
        password: hashedPassword,
        role: UserRole.TECHNICIAN,
        status: UserStatus.ACTIVE,
        needPasswordChange: true,
        emailVerified: true,
        phone: application.phone,
        address: application.address,
      },
      omit: { password: true },
    });

    const updated = await prisma.technicianApplication.update({
      where: { id: application.id },
      data: {
        status: ApplicationStatus.APPROVED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        userId: user.id,
      },
    });

    await sendDecisionEmail(application, true, undefined, tempPassword);

    await logAudit({
      action: "TECHNICIAN_APPLICATION_APPROVED",
      entity: "TechnicianApplication",
      entityId: application.id,
      actorId: reviewerId,
      metadata: { userId: user.id },
    });

    return updated;
  }

  const updated = await prisma.technicianApplication.update({
    where: { id: application.id },
    data: {
      status: ApplicationStatus.REJECTED,
      rejectionReason: payload.rejectionReason,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    },
  });

  await sendDecisionEmail(application, false, payload.rejectionReason);

  await logAudit({
    action: "TECHNICIAN_APPLICATION_REJECTED",
    entity: "TechnicianApplication",
    entityId: application.id,
    actorId: reviewerId,
  });

  return updated;
};

const getAllApplications = async (query: IQuery = {}) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(query);

  const andConditions: any[] = [];

  if (query.searchTerm) {
    const term = String(query.searchTerm);
    andConditions.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  if (query.status) {
    andConditions.push({ status: query.status as ApplicationStatus });
  }

  const where = andConditions.length > 0 ? { AND: andConditions } : {};

  const [applications, total] = await Promise.all([
    prisma.technicianApplication.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.technicianApplication.count({ where }),
  ]);

  return { data: applications, meta: buildMeta(total, page, limit) };
};

const getMyApplicationStatus = async (email: string) => {
  const application = await prisma.technicianApplication.findFirst({
    where: { email: email.trim().toLowerCase() },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      emailVerified: true,
      rejectionReason: true,
      updatedAt: true,
    },
  });

  if (!application) {
    throw new AppError(httpStatus.NOT_FOUND, "Application not found");
  }

  return application;
};

const purgeUnverifiedApplications = async (olderThanHours = 1) => {
  const cutoff = subHours(new Date(), olderThanHours);

  const result = await prisma.technicianApplication.deleteMany({
    where: {
      status: ApplicationStatus.PENDING,
      emailVerified: false,
      createdAt: { lt: cutoff },
    },
  });

  if (result.count > 0) {
    console.log(
      `[cron] purged ${result.count} unverified technician application(s)`,
    );
  }

  return result.count;
};

export const applicationService = {
  applyAsTechnician,
  resendApplicationOtp,
  verifyApplicationEmail,
  reviewApplication,
  getAllApplications,
  getMyApplicationStatus,
  purgeUnverifiedApplications,
};
