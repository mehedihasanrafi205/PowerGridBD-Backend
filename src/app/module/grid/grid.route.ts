import { Router } from "express";
import { gridController } from "./grid.controller";
import { auth } from "../../middleware/checkAuth";

import { gridValidation } from "./grid.validation";
import { UserRole } from "../../../generated/prisma/enums";
import { validateRequest } from "../../middleware/validateRequest";

const router = Router();


router.post(
  "/zones",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  validateRequest(gridValidation.createZoneValidationSchema),
  gridController.createZone,
);


router.get(
  "/zones",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR, UserRole.TECHNICIAN, UserRole.CUSTOMER),
  gridController.getAllZones,
);

export const GridRoutes = router;