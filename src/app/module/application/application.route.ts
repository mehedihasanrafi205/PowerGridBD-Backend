import { Router } from "express";
import { applicationController } from "./application.controller";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { applicationValidation } from "./application.validation";
import { UserRole } from "../../../generated/prisma/enums";

const router = Router();

router.post(
  "/",
  validateRequest(applicationValidation.applyTechnicianValidationSchema),
  applicationController.applyAsTechnician,
);

router.post(
  "/verify-email",
  validateRequest(applicationValidation.verifyApplicationEmailValidationSchema),
  applicationController.verifyApplicationEmail,
);

router.post(
  "/resend-otp",
  validateRequest(applicationValidation.resendOtpValidationSchema),
  applicationController.resendApplicationOtp,
);

router.get(
  "/my",
  applicationController.getMyApplicationStatus,
);

router.get(
  "/",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  applicationController.getAllApplications,
);

router.patch(
  "/:id/review",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  validateRequest(applicationValidation.reviewApplicationValidationSchema),
  applicationController.reviewApplication,
);

export const ApplicationRoutes = router;
