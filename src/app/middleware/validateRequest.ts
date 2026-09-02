import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { AnyZodObject, ZodEffects } from "zod";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

export const validateRequest = (schema: AnyZodObject | ZodEffects<AnyZodObject>) =>
	catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
		const result = schema.safeParse({
			body: req.body,
			query: req.query,
			params: req.params,
			cookies: req.cookies,
		});

		if (!result.success) {
			const firstIssue = result.error.issues[0];
			const message = firstIssue
				? `${firstIssue.path.join(".")} ${firstIssue.message}`
				: "Validation failed";
			throw new AppError(httpStatus.BAD_REQUEST, message);
		}

		Object.assign(req, result.data);
		next();
	});
