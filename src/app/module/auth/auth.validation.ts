import { z } from "zod";

const CustomerRegistrationZodSchema = z.object({
  name: z
    .string({ message: "Name must be a string" })
    .min(3, "Name must be at least 3 characters long")
    .max(50, "Name must be less than 50 characters long"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
    .regex(/[0-9]/, "Password must contain at least 1 number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least 1 special character",
    ),
  phone: z.string().optional(),
  address: z.string().optional(),
  areaId: z.string().optional(),
});

const EmailVerifyZodSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z
    .string({ message: "OTP is required" })
    .length(6, "OTP must be 6 digits long"),
});

const LoginZodSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const GoogleLoginZodSchema = z.object({
  idToken: z.string().min(1, "Google ID token is required"),
});

const ForgotPasswordZodSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const ResetPasswordZodSchema = z.object({
  email: z.string().email("Invalid email address"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
    .regex(/[0-9]/, "Password must contain at least 1 number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least 1 special character",
    ),
  otp: z
    .string({ message: "OTP is required" })
    .length(6, "OTP must be 6 digits long"),
});

export const authValidation = {
  CustomerRegistrationZodSchema,
  EmailVerifyZodSchema,
  LoginZodSchema,
  GoogleLoginZodSchema,
  ForgotPasswordZodSchema,
  ResetPasswordZodSchema,
};
