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

const updateOutageStatus = async (
  id: string,
  payload: { status?: OutageStatus; technicianId?: string },
) => {
  const isOutageExist = await prisma.outageReport.findUnique({
    where: { id },
  });

  if (!isOutageExist) {
    throw new AppError(httpStatus.NOT_FOUND, "Outage report not found");
  }

  if (payload.technicianId) {
    const technician = await prisma.user.findUnique({
      where: { id: payload.technicianId },
    });

    if (!technician || technician.role !== UserRole.TECHNICIAN) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Invalid technician ID or user is not a technician",
      );
    }
  }

  let resolvedAt = isOutageExist.resolvedAt;
  if (payload.status === OutageStatus.RESOLVED && !resolvedAt) {
    resolvedAt = new Date();
  }

  const updatedReport = await prisma.outageReport.update({
    where: { id },
    data: {
      ...payload,
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

export const outageService = {
  createOutageReport,
  getAllOutageReports,
  updateOutageStatus
};
