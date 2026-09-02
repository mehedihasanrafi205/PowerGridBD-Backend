import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { UserService } from "./user.service";

const updateProfileImage = catchAsync(async (req: Request, res: Response) => {
	const result = await UserService.updateProfileImage(req.user!.userId, req.file!);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile image updated successfully",
		data: result,
	});
});

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
	const result = await UserService.getAllUsers(req.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Users fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getSingleUser = catchAsync(async (req: Request, res: Response) => {
	const result = await UserService.getSingleUser(req.params.userId);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User fetched successfully",
		data: result,
	});
});

export const UserController = { updateProfileImage, getAllUsers, getSingleUser };
