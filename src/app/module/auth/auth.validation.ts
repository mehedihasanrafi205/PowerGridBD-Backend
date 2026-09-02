import { z } from "zod";

export const registerValidation = z.object({
	body: z.object({
		name: z.string({ required_error: "Name is required" }).min(1),
		email: z.string({ required_error: "Email is required" }).email(),
		password: z
			.string({ required_error: "Password is required" })
			.min(6, "Password must be at least 6 characters"),
	}),
});

export const verifyEmailValidation = z.object({
	body: z.object({
		email: z.string().email(),
		otp: z.string().length(6),
	}),
});

export const loginValidation = z.object({
	body: z.object({
		email: z.string().email(),
		password: z.string().min(1),
	}),
});

export const googleLoginValidation = z.object({
	body: z.object({
		idToken: z.string().min(1),
	}),
});

export const refreshTokenValidation = z.object({
	cookies: z
		.object({
			refreshToken: z.string().optional(),
		})
		.optional(),
});

export const forgotPasswordValidation = z.object({
	body: z.object({
		email: z.string().email(),
	}),
});

export const resetPasswordValidation = z.object({
	body: z.object({
		email: z.string().email(),
		otp: z.string().length(6),
		newPassword: z.string().min(6),
	}),
});
