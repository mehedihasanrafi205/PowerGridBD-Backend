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
const updateZone = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const result = await gridService.updateZone(id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Zone updated successfully",
    data: result,
  });
});

const deleteZone = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
  const result = await gridService.deleteZone(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Zone deleted successfully",
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
const updateSubstation = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const result = await gridService.updateSubstation(id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Substation updated successfully",
    data: result,
  });
});

const deleteSubstation = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const result = await gridService.deleteSubstation(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Substation deleted successfully",
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

const updateFeeder = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const result = await gridService.updateFeeder(id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Feeder updated successfully",
    data: result,
  });
});

const deleteFeeder = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const result = await gridService.deleteFeeder(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Feeder deleted successfully",
    data: result,
  });
});

const createArea = catchAsync(async (req: Request, res: Response) => {
  const result = await gridService.createArea(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Area created successfully",
    data: result,
  });
});

const getAllAreas = catchAsync(async (req: Request, res: Response) => {
  const result = await gridService.getAllAreas();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Areas retrieved successfully",
    data: result,
  });
});

const updateArea = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const result = await gridService.updateArea(id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Area updated successfully",
    data: result,
  });
});

const deleteArea = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const result = await gridService.deleteArea(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Area deleted successfully",
    data: result,
  });
});

export const gridController = {
  createZone,
  getAllZones,
  updateZone,
  deleteZone,
  createSubstation,
  getAllSubstations,
  updateSubstation,
  deleteSubstation,
  createFeeder,
  getAllFeeders,
  updateFeeder,
  deleteFeeder,
  createArea,
  getAllAreas,
  updateArea,
  deleteArea,
};
