import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";

import { AppError } from "../../utils/AppError";
import { outageService } from "./outage.service";

const createOutageReport = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not logged in");
  }
  const result = await outageService.createOutageReport(req.user.userId, req.body);
  
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
  const result = await outageService.getAllOutageReports(req.user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Outage reports retrieved successfully",
    data: result,
  });
});

export const outageController = {
  createOutageReport,
  getAllOutageReports,
};