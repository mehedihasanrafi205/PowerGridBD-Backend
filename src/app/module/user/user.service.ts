import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import { cloudinary } from "../../lib/cloudinary";
import { UploadApiResponse } from "cloudinary";
import { UserRole, UserStatus } from "../../../generated/prisma/enums";

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
  const currentUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      imagePublicId: true,
      imageUrl: true,
    },
  });

  const cloudinaryResult = await new Promise<UploadApiResponse>(
    (resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "powergrid/profiles",
            resource_type: "auto",
          },
          async (error, result) => {
            if (error) {
              return reject(error);
            }
            if (!result) {
              return reject(
                new AppError(
                  httpStatus.BAD_GATEWAY,
                  "No result returned from Cloudinary",
                ),
              );
            }
            resolve(result);
          },
        )
        .end(buffer);
    },
  );

  if (currentUser?.imagePublicId) {
    try {
      await cloudinary.uploader.destroy(currentUser.imagePublicId);
    } catch (destroyError) {
      console.error(
        "Failed to delete old image from Cloudinary:",
        destroyError,
      );
    }
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      imageUrl: cloudinaryResult?.secure_url,
      imagePublicId: cloudinaryResult?.public_id,
    },
    omit: {
      password: true,
    },
  });

  return updatedUser;
};

const updateProfile = async (
  userId: string,
  payload: { name?: string; phone?: string; address?: string },
) => {
  const isUserExists = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!isUserExists || isUserExists.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: payload,
    omit: {
      password: true,
    },
  });

  return updatedUser;
};

//!ADMIN 

const getAllUsers = async (query: Record<string, unknown>) => {
  const { page = 1, limit = 10, searchTerm, role, status } = query;
  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  const andConditions: any[] = [{ isDeleted: false }];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: searchTerm as string, mode: "insensitive" } },
        { email: { contains: searchTerm as string, mode: "insensitive" } },
      ],
    });
  }

  if (role) {
    andConditions.push({ role: role as UserRole });
  }

  if (status) {
    andConditions.push({ status: status as UserStatus });
  }

  const whereConditions = { AND: andConditions };

  const users = await prisma.user.findMany({
    where: whereConditions,
    skip,
    take: limitNumber,
    orderBy: { createdAt: "desc" },
    omit: { password: true },
  });

  const total = await prisma.user.count({ where: whereConditions });

  return {
    meta: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
    data: users,
  };
};


const getUserById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    omit: { password: true },
  });

  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return user;
};


const updateUserStatus = async (id: string, status: UserStatus) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { status },
    omit: { password: true },
  });

  return updatedUser;
};


const updateUserRole = async (id: string, role: UserRole) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { role },
    omit: { password: true },
  });

  return updatedUser;
};


const softDeleteUser = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const deletedUser = await prisma.user.update({
    where: { id },
    data: { isDeleted: true, status: UserStatus.BLOCKED },
    omit: { password: true },
  });

  return deletedUser;
};

export const userService = {
  uploadProfileImage,
  updateProfile,
  getAllUsers,
  getUserById,
  updateUserStatus,
  updateUserRole,
  softDeleteUser,
};
