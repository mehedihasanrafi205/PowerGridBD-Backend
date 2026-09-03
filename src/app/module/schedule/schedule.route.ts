import { Router } from "express";
import { scheduleController } from "./schedule.controller";
import { auth } from "../../middleware/checkAuth";
import { UserRole } from "../../../generated/prisma/enums";
import { validateRequest } from "../../middleware/validateRequest";
import { scheduleValidation } from "./schedule.validation";

const router = Router();

router.post(
  "/",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  validateRequest(scheduleValidation.createScheduleValidationSchema),
  scheduleController.createSchedule,
);

router.get(
  "/",
  auth(
    UserRole.ADMIN,
    UserRole.POWER_OPERATOR,
    UserRole.TECHNICIAN,
    UserRole.CUSTOMER,
  ),
  scheduleController.getAllSchedules,
);

router.get(
  "/:id",
  auth(
    UserRole.ADMIN,
    UserRole.POWER_OPERATOR,
    UserRole.TECHNICIAN,
    UserRole.CUSTOMER,
  ),
  scheduleController.getSingleSchedule,
);

router.delete(
  "/:id",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  scheduleController.deleteSchedule,
);

export const ScheduleRoutes = router;
