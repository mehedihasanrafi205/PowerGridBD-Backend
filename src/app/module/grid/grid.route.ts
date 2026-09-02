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
  auth(
    UserRole.ADMIN,
    UserRole.POWER_OPERATOR,
    UserRole.TECHNICIAN,
    UserRole.CUSTOMER,
  ),
  gridController.getAllZones,
);

router.patch(
  "/zones/:id",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  validateRequest(gridValidation.updateZoneValidationSchema),
  gridController.updateZone,
);

router.post(
  "/substations",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  validateRequest(gridValidation.createSubstationValidationSchema),
  gridController.createSubstation,
);

router.get(
  "/substations",
  auth(
    UserRole.ADMIN,
    UserRole.POWER_OPERATOR,
    UserRole.TECHNICIAN,
    UserRole.CUSTOMER,
  ),
  gridController.getAllSubstations,
);

router.post(
  "/feeders",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  validateRequest(gridValidation.createFeederValidationSchema),
  gridController.createFeeder,
);

router.get(
  "/feeders",
  auth(
    UserRole.ADMIN,
    UserRole.POWER_OPERATOR,
    UserRole.TECHNICIAN,
    UserRole.CUSTOMER,
  ),
  gridController.getAllFeeders,
);

(router.post(
  "/areas",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  validateRequest(gridValidation.createAreaValidationSchema),
  gridController.createArea,
),
  router.get(
    "/areas",
    auth(
      UserRole.ADMIN,
      UserRole.POWER_OPERATOR,
      UserRole.TECHNICIAN,
      UserRole.CUSTOMER,
    ),
    gridController.getAllAreas,
  ));

export const GridRoutes = router;
