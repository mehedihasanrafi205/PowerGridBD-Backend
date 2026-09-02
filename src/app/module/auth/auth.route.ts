import { Router } from "express";

import { auth } from "../../middleware/checkAuth";

import { AuthController } from "./auth.controller";
import { authValidation } from "./auth.validation";
import { validateRequest } from "../../middleware/validateRequest";
import { UserRole } from "../../../generated/prisma/enums";

const router = Router();

router.post(
  "/register",
  validateRequest(authValidation.CustomerRegistrationZodSchema),
  AuthController.registerCustomer,
);

router.post(
  "/verify-email",
  validateRequest(authValidation.EmailVerifyZodSchema),
  AuthController.verifyCustomerEmail,
);

router.post(
  "/login",
  validateRequest(authValidation.LoginZodSchema),
  AuthController.loginUser,
);

router.get(
  "/me",
  auth(UserRole.CUSTOMER, UserRole.TECHNICIAN, UserRole.POWER_OPERATOR, UserRole.ADMIN),
  AuthController.getMe,
);

router.post("/refresh-token", AuthController.refreshToken);

router.post(
  "/google",
  validateRequest(authValidation.GoogleLoginZodSchema),
  AuthController.googleLogin,
);

router.post(
  "/forgot-password",
  validateRequest(authValidation.ForgotPasswordZodSchema),
  AuthController.forgotPassword,
);

router.post(
  "/reset-password",
  validateRequest(authValidation.ResetPasswordZodSchema),
  AuthController.resetPassword,
);

export const AuthRoutes = router;