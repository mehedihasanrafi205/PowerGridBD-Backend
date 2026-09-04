import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import { cloudinary } from "../../lib/cloudinary";
import { UploadApiResponse } from "cloudinary";
import { UserRole, UserStatus } from "../../../generated/prisma/enums";
import type { IQuery } from "../../interfaces";
import { calculatePagination, buildMeta } from "../../utils/pagination";
import { logAudit } from "../../utils/audit";
import { sendTemplatedEmail } from "../../utils/notify";

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

const getAllUsers = async (query: IQuery) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(query, {
    sortBy: "createdAt",
  });
  const { searchTerm, role, status } = query;

  const andConditions: any[] = [{ isDeleted: false }];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: String(searchTerm), mode: "insensitive" } },
        { email: { contains: String(searchTerm), mode: "insensitive" } },
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

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereConditions,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      omit: { password: true },
    }),
    prisma.user.count({ where: whereConditions }),
  ]);

  return {
    meta: buildMeta(total, page, limit),
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


const STAFF_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.POWER_OPERATOR,
  UserRole.TECHNICIAN,
];

const ensureNotLastActiveAdmin = async (id: string) => {
  const activeAdmins = await prisma.user.count({
    where: {
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      isDeleted: false,
      id: { not: id },
    },
  });

  if (activeAdmins === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Operation refused: this is the last active admin account",
    );
  }
};

const updateUserStatus = async (
  id: string,
  status: UserStatus,
  actorId?: string,
) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.status === status) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `User status is already ${status}`,
    );
  }

  if (
    user.role === UserRole.ADMIN &&
    user.status === UserStatus.ACTIVE &&
    status !== UserStatus.ACTIVE
  ) {
    await ensureNotLastActiveAdmin(id);
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { status },
    omit: { password: true },
  });

  await logAudit({
    action: "USER_STATUS_CHANGED",
    entity: "User",
    entityId: id,
    actorId,
    metadata: { from: user.status, to: status },
  });

  await sendTemplatedEmail(
    user.email,
    "Account Status Updated - PowerGridBD",
    "account-status.ejs",
    { name: user.name, status },
  );

  return updatedUser;
};


const updateUserRole = async (
  id: string,
  role: UserRole,
  actorId?: string,
  actorRole?: UserRole,
) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // Operators manage field crews only: they may grant TECHNICIAN to
  // customers and revoke it back to CUSTOMER — nothing else.
  if (actorRole === UserRole.POWER_OPERATOR) {
    const isGrant = user.role === UserRole.CUSTOMER && role === UserRole.TECHNICIAN;
    const isRevoke =
      user.role === UserRole.TECHNICIAN && role === UserRole.CUSTOMER;
    if (!isGrant && !isRevoke) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Power operators may only grant or revoke the technician role",
      );
    }
  }

  if (user.role === role) {
    throw new AppError(httpStatus.BAD_REQUEST, `User role is already ${role}`);
  }

  if (STAFF_ROLES.includes(role) && !user.emailVerified) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "User email must be verified before granting a staff role",
    );
  }

  if (user.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
    await ensureNotLastActiveAdmin(id);
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { role },
    omit: { password: true },
  });

  await logAudit({
    action: "USER_ROLE_CHANGED",
    entity: "User",
    entityId: id,
    actorId,
    metadata: { from: user.role, to: role },
  });

  await sendTemplatedEmail(
    user.email,
    "Account Role Updated - PowerGridBD",
    "role-assigned.ejs",
    { name: user.name, previousRole: user.role, newRole: role },
  );

  return updatedUser;
};


const softDeleteUser = async (id: string, actorId?: string) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.role === UserRole.ADMIN) {
    await ensureNotLastActiveAdmin(id);
  }

  const deletedUser = await prisma.user.update({
    where: { id },
    data: { isDeleted: true, status: UserStatus.BLOCKED },
    omit: { password: true },
  });

  await logAudit({
    action: "USER_SOFT_DELETED",
    entity: "User",
    entityId: id,
    actorId,
  });

  await sendTemplatedEmail(
    user.email,
    "Account Status Updated - PowerGridBD",
    "account-status.ejs",
    { name: user.name, status: UserStatus.BLOCKED },
  );

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
