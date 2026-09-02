import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { UserRole, type UserStatus } from "../../../generated/prisma/enums";
import { paginationArgs, parseQueryOptions, withMeta } from "../../builder/queryBuilder";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IQueryUserFilters } from "./user.interface";

const updateProfileImage = async (userId: string, file: Express.Multer.File) => {
	const user = await prisma.user.findUnique({ where: { id: userId } });
	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.imagePublicId) {
		await cloudinary.uploader.destroy(user.imagePublicId);
	}

	const base64 = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
	const uploaded = await cloudinary.uploader.upload(base64, {
		folder: "powergridbd/profiles",
		public_id: user.id,
		overwrite: true,
	});

	const updated = await prisma.user.update({
		where: { id: userId },
		data: { imageUrl: uploaded.secure_url, imagePublicId: uploaded.public_id },
		omit: { password: true },
	});

	return updated;
};

const getAllUsers = async (query: IQueryUserFilters) => {
	const options = parseQueryOptions(query as Record<string, unknown>, "createdAt");

	const where: Prisma.UserWhereInput = {
		isDeleted: false,
	};

	const { role, status, searchTerm } = query;
	if (role) where.role = role;
	if (status) where.status = status as UserStatus;
	if (searchTerm) {
		where.OR = [
			{ name: { contains: searchTerm, mode: "insensitive" } },
			{ email: { contains: searchTerm, mode: "insensitive" } },
		];
	}

	const [total, users] = await Promise.all([
		prisma.user.count({ where }),
		prisma.user.findMany({
			where,
			...paginationArgs(options),
			omit: { password: true },
		}),
	]);

	return withMeta(users, total, options);
};

const getSingleUser = async (userId: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		omit: { password: true },
	});
	if (!user || user.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}
	return user;
};

export const UserService = { updateProfileImage, getAllUsers, getSingleUser };
