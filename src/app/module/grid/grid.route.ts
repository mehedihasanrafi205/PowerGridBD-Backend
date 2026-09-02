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
router.delete(
  "/zones/:id",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  gridController.deleteZone,
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

router.patch(
  "/substations/:id",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  validateRequest(gridValidation.updateSubstationValidationSchema),
  gridController.updateSubstation,
);
router.delete(
  "/substations/:id",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  gridController.deleteSubstation,
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
router.patch(
  "/feeders/:id",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  validateRequest(gridValidation.updateFeederValidationSchema),
  gridController.updateFeeder,
);
router.delete(
  "/feeders/:id",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  gridController.deleteFeeder,
);
router.post(
  "/areas",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  validateRequest(gridValidation.createAreaValidationSchema),
  gridController.createArea,
);
router.get(
  "/areas",
  auth(
    UserRole.ADMIN,
    UserRole.POWER_OPERATOR,
    UserRole.TECHNICIAN,
    UserRole.CUSTOMER,
  ),
  gridController.getAllAreas,
);

router.patch(
  "/areas/:id",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  validateRequest(gridValidation.updateAreaValidationSchema),
  gridController.updateArea,
);
router.delete(
  "/areas/:id",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  gridController.deleteArea,
);

export const GridRoutes = router;
