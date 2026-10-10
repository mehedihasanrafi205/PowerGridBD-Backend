import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AppError } from "../../utils/AppError";
import { analyticsService } from "./analytics.service";
import { validateRequest } from "../../middleware/validateRequest";
import { analyticsValidation } from "./analytics.validation";

const getOperationalMetrics = catchAsync(async (_req: Request, res: Response) => {
  const result = await analyticsService.getOperationalMetrics();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Operational metrics retrieved successfully",
    data: result,
  });
});

const getPerformanceMetrics = catchAsync(async (_req: Request, res: Response) => {
  const result = await analyticsService.getPerformanceMetrics();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Performance metrics retrieved successfully",
    data: result,
  });
});

const getTechnicianWorkload = catchAsync(async (_req: Request, res: Response) => {
  const result = await analyticsService.getTechnicianWorkload();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Technician workload retrieved successfully",
    data: result,
  });
});

const getSlaPlans = catchAsync(async (_req: Request, res: Response) => {
  const result = await analyticsService.getSlaPlans();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "SLA plans retrieved successfully",
    data: result,
  });
});

const getSlaPlanById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await analyticsService.getSlaPlanById(Array.isArray(id) ? id[0] : id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "SLA plan retrieved successfully",
    data: result,
  });
});

const subscribeToSla = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not authenticated");
  }
  const result = await analyticsService.subscribeToSla(req.user.userId, req.body.planId);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "SLA subscription created successfully. Please complete payment to activate.",
    data: result,
  });
});

const getMySlaSubscription = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not authenticated");
  }
  const result = await analyticsService.getMySlaSubscription(req.user.userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result ? "Active SLA subscription found" : "No active SLA subscription",
    data: result,
  });
});

const getGeographicalAnalytics = catchAsync(
  async (_req: Request, res: Response) => {
    const result = await analyticsService.getGeographicalAnalytics();

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Geographical analytics retrieved successfully",
      data: result,
    });
  },
);

const getFinancialAnalytics = catchAsync(async (_req: Request, res: Response) => {
  const result = await analyticsService.getFinancialAnalytics();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Financial analytics retrieved successfully",
    data: result,
  });
});

const getTrendsAnalytics = catchAsync(async (req: Request, res: Response) => {
  const rawDays = Number(req.query.days);
  const days =
    Number.isFinite(rawDays) && rawDays >= 7 && rawDays <= 365
      ? Math.floor(rawDays)
      : 30;
  const result = await analyticsService.getTrendsAnalytics(days);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Trend analytics retrieved successfully",
    data: result,
  });
});

const getCustomerSummary = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not authenticated");
  }
  const result = await analyticsService.getCustomerSummary(req.user.userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Customer summary retrieved successfully",
    data: result,
  });
});

const getTechnicianSummary = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not authenticated");
  }
  const result = await analyticsService.getTechnicianSummary(req.user.userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Technician summary retrieved successfully",
    data: result,
  });
});

const getAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const result = await analyticsService.getAuditLogs(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Audit logs retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

export const analyticsController = {
  getOperationalMetrics,
  getPerformanceMetrics,
  getTechnicianWorkload,
  getSlaPlans,
  getSlaPlanById,
  subscribeToSla,
  getMySlaSubscription,
  getGeographicalAnalytics,
  getFinancialAnalytics,
  getTrendsAnalytics,
  getCustomerSummary,
  getTechnicianSummary,
  getAuditLogs,
};
