import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { scheduleService } from "./schedule.service";
import { AppError } from "../../utils/AppError";

const createSchedule = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not logged in");
  }
  const result = await scheduleService.createSchedule(req.user.userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Schedule created successfully",
    data: result,
  });
});

const getAllSchedules = catchAsync(async (req: Request, res: Response) => {
  const result = await scheduleService.getAllSchedules();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedules retrieved successfully",
    data: result,
  });
});

const getSingleSchedule = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const result = await scheduleService.getSingleSchedule(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedule retrieved successfully",
    data: result,
  });
});

const updateScheduleStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { status } = req.body;

  const result = await scheduleService.updateScheduleStatus(id, status);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedule status updated successfully",
    data: result,
  });
});

const deleteSchedule = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const result = await scheduleService.deleteSchedule(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedule deleted successfully",
    data: result,
  });
});

export const scheduleController = {
  createSchedule,
  getAllSchedules,
  getSingleSchedule,
  updateScheduleStatus,
  deleteSchedule,
};