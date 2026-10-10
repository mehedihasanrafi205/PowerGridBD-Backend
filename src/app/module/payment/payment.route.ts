import { Router } from "express";
import { paymentController } from "./payment.controller";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { paymentValidation } from "./payment.validation";
import { UserRole } from "../../../generated/prisma/enums";

const router = Router();

router.post(
  "/",
  auth(UserRole.CUSTOMER),
  validateRequest(paymentValidation.initiatePaymentSchema),
  paymentController.initiatePayment,
);

router.get("/ipn", paymentController.handleIPN);
router.post("/ipn", paymentController.handleIPN);

router.get("/success", paymentController.successCallback);
router.post("/success", paymentController.successCallback);

router.get("/fail", paymentController.failCallback);
router.post("/fail", paymentController.failCallback);

router.get("/cancel", paymentController.cancelCallback);
router.post("/cancel", paymentController.cancelCallback);

router.get(
  "/transaction/:id",
  auth(
    UserRole.ADMIN,
    UserRole.POWER_OPERATOR,
    UserRole.TECHNICIAN,
    UserRole.CUSTOMER,
  ),
  paymentController.getPaymentByTransactionId,
);

router.get(
  "/my-payments",
  auth(UserRole.CUSTOMER),
  paymentController.getUserPayments,
);

router.post(
  "/refund",
  auth(UserRole.CUSTOMER),
  validateRequest(paymentValidation.refundPaymentSchema),
  paymentController.initiateRefund,
);

export const PaymentRoutes = router;
