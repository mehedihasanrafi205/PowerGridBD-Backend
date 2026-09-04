import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";

import { AppError } from "../../utils/AppError";
import { outageService } from "./outage.service";
import { OutageStatus, UserRole } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";

const createOutageReport = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not logged in");
  }
  const result = await outageService.createOutageReport(
    req.user.userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Outage report submitted successfully",
    data: result,
  });
});

const getAllOutageReports = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not logged in");
  }
  const result = await outageService.getAllOutageReports(req.user, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Outage reports retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const assignTechnician = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { technicianId } = req.body;

  const result = await outageService.assignTechnician(
    id,
    technicianId,
    req.user?.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Technician assigned successfully",
    data: result,
  });
});

const updateOutageStatus = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not logged in");
  }
  const { id } = req.params as { id: string };
  const { status } = req.body;

  const result = await outageService.updateOutageStatus(req.user, id, status);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Outage report status updated successfully",
    data: result,
  });
});

const getSingleOutageReport = catchAsync(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(httpStatus.UNAUTHORIZED, "You are not logged in");
    }
    const { id } = req.params as { id: string };
    const result = await outageService.getSingleOutageReport(req.user, id);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Outage report retrieved successfully",
      data: result,
    });
  },
);

const deleteOutageReport = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not logged in");
  }
  const { id } = req.params as { id: string };
  const result = await outageService.deleteOutageReport(req.user, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Outage report deleted successfully",
    data: result,
  });
});

export const outageController = {
  createOutageReport,
  getAllOutageReports,
  getSingleOutageReport,
  assignTechnician,
  updateOutageStatus,
  deleteOutageReport,
};
