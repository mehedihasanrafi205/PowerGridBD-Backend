import { Router } from "express";
import { outageController } from "./outage.controller";
import { auth } from "../../middleware/checkAuth";

import { outageValidation } from "./outage.validation";
import { UserRole } from "../../../generated/prisma/enums";
import { validateRequest } from "../../middleware/validateRequest";

const router = Router();

router.post(
  "/",
  auth(UserRole.CUSTOMER),
  validateRequest(outageValidation.createOutageReportValidationSchema),
  outageController.createOutageReport,
);

router.get(
  "/",
  auth(
    UserRole.ADMIN,
    UserRole.POWER_OPERATOR,
    UserRole.TECHNICIAN,
    UserRole.CUSTOMER,
  ),
  outageController.getAllOutageReports,
);

export const OutageRoutes = router;
