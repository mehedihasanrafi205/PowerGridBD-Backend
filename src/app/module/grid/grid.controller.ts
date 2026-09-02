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

const createSubstation = catchAsync(async (req: Request, res: Response) => {
  const result = await gridService.createSubstation(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Substation created successfully",
    data: result,
  });
});

const getAllSubstations = catchAsync(async (req: Request, res: Response) => {
  const result = await gridService.getAllSubstations();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Substations retrieved successfully",
    data: result,
  });
});

const createFeeder = catchAsync(async (req: Request, res: Response) => {
  const result = await gridService.createFeeder(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Feeder created successfully",
    data: result,
  });
});

const getAllFeeders = catchAsync(async (req: Request, res: Response) => {
  const result = await gridService.getAllFeeders();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Feeders retrieved successfully",
    data: result,
  });
});

export const gridController = {
  createZone,
  getAllZones,
  createSubstation,
  getAllSubstations,
  createFeeder,
  getAllFeeders,
};
