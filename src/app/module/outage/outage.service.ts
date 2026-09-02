import { UserRole } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";


const createOutageReport = async (userId: string, payload: { description: string; areaId: string }) => {
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


const getAllOutageReports = async (user: { userId: string; role: UserRole }) => {
  let query = {};

  if (user.role === UserRole.CUSTOMER) {
    query = { customerId: user.userId };
  } 

  else if (user.role === UserRole.TECHNICIAN) {
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

export const outageService = {
  createOutageReport,
  getAllOutageReports,
};