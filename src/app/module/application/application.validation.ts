import { z } from "zod";
import { ApplicationStatus } from "../../../generated/prisma/enums";

const applyTechnicianValidationSchema = z.object({
  name: z.string("Name is required").min(2, "Name must be at least 2 characters"),
  email: z.email("Valid email is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
  experience: z.string().optional(),
  bio: z.string().optional(),
});

const verifyApplicationEmailValidationSchema = z.object({
  email: z.email("Valid email is required"),
  otp: z.string("OTP is required").length(6, "OTP must be 6 digits"),
});

const reviewApplicationValidationSchema = z
  .object({
    status: z.nativeEnum(ApplicationStatus, "Status is required"),
    rejectionReason: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.status === ApplicationStatus.REJECTED &&
      !data.rejectionReason?.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Rejection reason is required when rejecting an application",
        path: ["rejectionReason"],
      });
    }
    if (data.status === ApplicationStatus.PENDING) {
      ctx.addIssue({
        code: "custom",
        message: "Application must be approved or rejected",
        path: ["status"],
      });
    }
  });

export const applicationValidation = {
  applyTechnicianValidationSchema,
  verifyApplicationEmailValidationSchema,
  reviewApplicationValidationSchema,
  resendOtpValidationSchema: z.object({
    email: z.email("Valid email is required"),
  }),
};
