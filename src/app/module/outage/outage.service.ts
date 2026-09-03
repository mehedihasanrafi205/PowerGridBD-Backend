import { OutageStatus, UserRole } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";

const createOutageReport = async (
  userId: string,
  payload: { description: string; areaId: string },
) => {
  const isAreaExist = await prisma.area.findUnique({
    where: { id: payload.areaId },
  });

  if (!isAreaExist) {
    throw new AppError(httpStatus.NOT_FOUND, "Area not found");
  }

  const outageReport = await prisma.outageReport.create({
    data: {
      description: payload.description,
      areaId: payload.areaId,
      customerId: userId,
    },
    include: {
      area: {
        include: {
          feeder: {
            include: {
              substation: {
                include: { zone: true },
              },
            },
          },
        },
      },
      customer: {
        select: { id: true, name: true, email: true, phone: true },
      },
    },
  });

  return outageReport;
};

const getAllOutageReports = async (user: {
  userId: string;
  role: UserRole;
}) => {
  let query = {};

  if (user.role === UserRole.CUSTOMER) {
    query = { customerId: user.userId };
  } else if (user.role === UserRole.TECHNICIAN) {
    query = { technicianId: user.userId };
  }

  const reports = await prisma.outageReport.findMany({
    where: query,
    include: {
      area: true,
      customer: { select: { id: true, name: true, phone: true } },
      technician: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { reportedAt: "desc" },
  });

  return reports;
};
const getSingleOutageReport = async (
  user: { userId: string; role: UserRole },
  id: string,
) => {
  const outageReport = await prisma.outageReport.findUnique({
    where: { id },
    include: {
      area: {
        include: {
          feeder: {
            include: {
              substation: {
                include: { zone: true },
              },
            },
          },
        },
      },
      customer: { select: { id: true, name: true, email: true, phone: true } },
      technician: {
        select: { id: true, name: true, email: true, phone: true },
      },
    },
  });

  if (!outageReport) {
    throw new AppError(httpStatus.NOT_FOUND, "Outage report not found");
  }

  if (
    user.role === UserRole.CUSTOMER &&
    outageReport.customerId !== user.userId
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to view this report",
    );
  }
  if (
    user.role === UserRole.TECHNICIAN &&
    outageReport.technicianId !== user.userId
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to view this report",
    );
  }

  return outageReport;
};

const assignTechnician = async (id: string, technicianId: string) => {
  const isOutageExist = await prisma.outageReport.findUnique({
    where: { id },
  });

  if (!isOutageExist) {
    throw new AppError(httpStatus.NOT_FOUND, "Outage report not found");
  }

  // টেকনিশিয়ান ভ্যালিড কি না চেক করা
  const technician = await prisma.user.findUnique({
    where: { id: technicianId },
  });

  if (!technician || technician.role !== UserRole.TECHNICIAN) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid technician ID or user is not a technician",
    );
  }

  const updatedReport = await prisma.outageReport.update({
    where: { id },
    data: {
      technicianId,
      status: OutageStatus.ASSIGNED, // টেকনিশিয়ান অ্যাসাইন করলেই স্ট্যাটাস স্বয়ংক্রিয়ভাবে ASSIGNED হয়ে যাবে
    },
    include: {
      area: true,
      customer: { select: { id: true, name: true, phone: true } },
      technician: { select: { id: true, name: true, phone: true } },
    },
  });

  return updatedReport;
};

const updateOutageStatus = async (
  user: { userId: string; role: UserRole },
  id: string,
  status: OutageStatus,
) => {
  const isOutageExist = await prisma.outageReport.findUnique({
    where: { id },
  });

  if (!isOutageExist) {
    throw new AppError(httpStatus.NOT_FOUND, "Outage report not found");
  }

  if (user.role === UserRole.TECHNICIAN) {
    if (isOutageExist.technicianId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not authorized to update this outage report",
      );
    }
  }

  let resolvedAt = isOutageExist.resolvedAt;
  if (status === OutageStatus.RESOLVED && !resolvedAt) {
    resolvedAt = new Date();
  }

  const updatedReport = await prisma.outageReport.update({
    where: { id },
    data: {
      status,
      resolvedAt,
    },
    include: {
      area: true,
      customer: { select: { id: true, name: true, phone: true } },
      technician: { select: { id: true, name: true, phone: true } },
    },
  });

  return updatedReport;
};

const deleteOutageReport = async (
  user: { userId: string; role: UserRole },
  id: string,
) => {
  const outageReport = await prisma.outageReport.findUnique({
    where: { id },
  });

  if (!outageReport) {
    throw new AppError(httpStatus.NOT_FOUND, "Outage report not found");
  }

  if (user.role === UserRole.CUSTOMER) {
    if (outageReport.customerId !== user.userId) {
      throw new AppError(httpStatus.FORBIDDEN, "You cannot delete this report");
    }
    if (outageReport.status !== OutageStatus.PENDING) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You can only delete PENDING reports",
      );
    }
  }

  return await prisma.outageReport.delete({
    where: { id },
  });
};

export const outageService = {
  createOutageReport,
  getAllOutageReports,
  getSingleOutageReport,
  assignTechnician,
  updateOutageStatus,
  deleteOutageReport,
};
