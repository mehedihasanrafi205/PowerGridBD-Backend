import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import {
	forgotPasswordValidation,
	googleLoginValidation,
	loginValidation,
	refreshTokenValidation,
	registerValidation,
	resetPasswordValidation,
	verifyEmailValidation,
} from "./auth.validation";

const router = Router();

router.post("/register", validateRequest(registerValidation), AuthController.register);
router.post("/verify-email", validateRequest(verifyEmailValidation), AuthController.verifyEmail);
router.post("/login", validateRequest(loginValidation), AuthController.login);
router.post("/google", validateRequest(googleLoginValidation), AuthController.googleLogin);
router.get(
	"/me",
	auth(UserRole.ADMIN, UserRole.POWER_OPERATOR, UserRole.TECHNICIAN, UserRole.CUSTOMER),
	AuthController.getMe,
);
router.post("/refresh-token", validateRequest(refreshTokenValidation), AuthController.refreshToken);
router.post(
	"/forgot-password",
	validateRequest(forgotPasswordValidation),
	AuthController.forgotPassword,
);
router.post(
	"/reset-password",
	validateRequest(resetPasswordValidation),
	AuthController.resetPassword,
);

export const AuthRoutes = router;
