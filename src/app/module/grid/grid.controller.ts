import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { gridService } from "./grid.service";

const createZone = catchAsync(async (req: Request, res: Response) => {
  const result = await gridService.createZone(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Zone created successfully",
    data: result,
  });
});

const getAllZones = catchAsync(async (req: Request, res: Response) => {
  const result = await gridService.getAllZones();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Zones retrieved successfully",
    data: result,
  });
});

export const gridController = {
  createZone,
  getAllZones,
};