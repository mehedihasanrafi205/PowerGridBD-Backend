import { Router } from "express";
import { analyticsController } from "./analytics.controller";
import { auth } from "../../middleware/checkAuth";
import { UserRole } from "../../../generated/prisma/enums";

const router = Router();

router.get(
  "/operational",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  analyticsController.getOperationalMetrics,
);

router.get(
  "/performance",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  analyticsController.getPerformanceMetrics,
);

router.get(
  "/technician-workload",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  analyticsController.getTechnicianWorkload,
);

router.get(
  "/geographical",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  analyticsController.getGeographicalAnalytics,
);

router.get(
  "/financial",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  analyticsController.getFinancialAnalytics,
);

router.get(
  "/trends",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  analyticsController.getTrendsAnalytics,
);

router.get(
  "/my-summary",
  auth(UserRole.CUSTOMER),
  analyticsController.getCustomerSummary,
);

router.get(
  "/technician-summary",
  auth(UserRole.TECHNICIAN),
  analyticsController.getTechnicianSummary,
);

router.get(
  "/audit-logs",
  auth(UserRole.ADMIN),
  analyticsController.getAuditLogs,
);

export const AnalyticsRoutes = router;
