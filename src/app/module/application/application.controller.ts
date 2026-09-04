import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AppError } from "../../utils/AppError";
import { applicationService } from "./application.service";

const applyAsTechnician = catchAsync(async (req: Request, res: Response) => {
  const result = await applicationService.applyAsTechnician(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Application submitted. Please verify your email with the OTP sent.",
    data: result,
  });
});

const resendApplicationOtp = catchAsync(async (req: Request, res: Response) => {
  const result = await applicationService.resendApplicationOtp(req.body.email);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Verification OTP resent successfully",
    data: result,
  });
});

const verifyApplicationEmail = catchAsync(
  async (req: Request, res: Response) => {
    const result = await applicationService.verifyApplicationEmail(req.body);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Email verified. Your application is now pending review.",
      data: result,
    });
  },
);

const reviewApplication = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not authenticated");
  }
  const { id } = req.params as { id: string };
  const result = await applicationService.reviewApplication(
    { applicationId: id, ...req.body },
    req.user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Application reviewed successfully",
    data: result,
  });
});

const getAllApplications = catchAsync(async (req: Request, res: Response) => {
  const result = await applicationService.getAllApplications(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Applications retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getMyApplicationStatus = catchAsync(
  async (req: Request, res: Response) => {
    const result = await applicationService.getMyApplicationStatus(
      String(req.query.email ?? ""),
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Application status retrieved successfully",
      data: result,
    });
  },
);

export const applicationController = {
  applyAsTechnician,
  resendApplicationOtp,
  verifyApplicationEmail,
  reviewApplication,
  getAllApplications,
  getMyApplicationStatus,
};
