import { OutageStatus, UserRole } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import type { IQuery } from "../../interfaces";
import { calculatePagination, buildMeta } from "../../utils/pagination";
import { logAudit } from "../../utils/audit";
import { sendTemplatedEmail } from "../../utils/notify";
import type {
  IAssignTechnicianPayload,
  ICreateOutageReportPayload,
  IUpdateOutageStatusPayload,
} from "./outage.interface";

const createOutageReport = async (
  userId: string,
  payload: ICreateOutageReportPayload,
) => {
  const isAreaExist = await prisma.area.findUnique({
    where: { id: payload.areaId },
  });

  if (!isAreaExist) {
    throw new AppError(httpStatus.NOT_FOUND, "Area not found");
  }

  // Active SLA subscribers get priority handling on every new report.
  const subscriber = await prisma.user.findUnique({
    where: { id: userId },
    select: { slaActive: true, slaExpiryDate: true },
  });
  const hasActiveSla =
    !!subscriber?.slaActive &&
    !!subscriber.slaExpiryDate &&
    subscriber.slaExpiryDate > new Date();

  const outageReport = await prisma.outageReport.create({
    data: {
      description: payload.description,
      areaId: payload.areaId,
      customerId: userId,
      isPriority: hasActiveSla,
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

  await sendTemplatedEmail(
    outageReport.customer.email,
    "Outage Report Received - PowerGridBD",
    "outage-received.ejs",
    {
      name: outageReport.customer.name,
      reportId: outageReport.id,
      areaName: outageReport.area.name,
      description: outageReport.description,
    },
  );

  return outageReport;
};

const getAllOutageReports = async (
  user: {
    userId: string;
    role: UserRole;
  },
  query: IQuery = {},
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(query, {
    sortBy: "reportedAt",
  });

  const andConditions: any[] = [];

  // Role scope: customers see own, technicians see assigned, admin/operator see all
  if (user.role === UserRole.CUSTOMER) {
    andConditions.push({ customerId: user.userId });
  } else if (user.role === UserRole.TECHNICIAN) {
    andConditions.push({ technicianId: user.userId });
  }

  if (query.searchTerm) {
    const term = String(query.searchTerm);
    andConditions.push({
      OR: [
        { description: { contains: term, mode: "insensitive" } },
        { customer: { name: { contains: term, mode: "insensitive" } } },
        { area: { name: { contains: term, mode: "insensitive" } } },
      ],
    });
  }

  if (query.status) {
    andConditions.push({ status: query.status as OutageStatus });
  }

  if (query.areaId) {
    andConditions.push({ areaId: String(query.areaId) });
  }

  if (query.isPriority !== undefined && query.isPriority !== "") {
    andConditions.push({
      isPriority: String(query.isPriority).toLowerCase() === "true",
    });
  }

  if (query.from || query.to) {
    const reportedAt: { gte?: Date; lte?: Date } = {};
    if (query.from) reportedAt.gte = new Date(String(query.from));
    if (query.to) reportedAt.lte = new Date(String(query.to));
    andConditions.push({ reportedAt });
  }

  const where = andConditions.length > 0 ? { AND: andConditions } : {};

  // Staff work queues always surface priority reports first; customers
  // keep a plain chronological view of their own reports.
  const orderBy =
    user.role === UserRole.CUSTOMER
      ? { [sortBy]: sortOrder }
      : [{ isPriority: "desc" as const }, { [sortBy]: sortOrder }];

  const [reports, total] = await Promise.all([
    prisma.outageReport.findMany({
      where,
      include: {
        area: true,
        customer: { select: { id: true, name: true, phone: true } },
        technician: { select: { id: true, name: true, phone: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.outageReport.count({ where }),
  ]);

  return { data: reports, meta: buildMeta(total, page, limit) };
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

const assignTechnician = async (
  id: string,
  payload: IAssignTechnicianPayload | string,
  actorId?: string,
) => {
  const technicianId =
    typeof payload === "string" ? payload : payload.technicianId;
  const isOutageExist = await prisma.outageReport.findUnique({
    where: { id },
  });

  if (!isOutageExist) {
    throw new AppError(httpStatus.NOT_FOUND, "Outage report not found");
  }

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
      status: OutageStatus.ASSIGNED,
      assignedAt: new Date(),
    },
    include: {
      area: true,
      customer: { select: { id: true, name: true, email: true, phone: true } },
      technician: {
        select: { id: true, name: true, email: true, phone: true },
      },
    },
  });

  if (updatedReport.technician) {
    await sendTemplatedEmail(
      updatedReport.technician.email,
      "New Outage Task Assigned - PowerGridBD",
      "technician-assigned.ejs",
      {
        name: updatedReport.technician.name,
        forTechnician: true,
        reportId: updatedReport.id,
        areaName: updatedReport.area.name,
        description: updatedReport.description,
        customerName: updatedReport.customer.name,
        customerPhone: updatedReport.customer.phone ?? "N/A",
      },
    );
  }

  await sendTemplatedEmail(
    updatedReport.customer.email,
    "Technician Assigned to Your Outage Report - PowerGridBD",
    "technician-assigned.ejs",
    {
      name: updatedReport.customer.name,
      forTechnician: false,
      reportId: updatedReport.id,
      technicianName: updatedReport.technician?.name ?? "Field crew",
    },
  );

  await logAudit({
    action: "OUTAGE_TECHNICIAN_ASSIGNED",
    entity: "OutageReport",
    entityId: id,
    actorId,
    metadata: { technicianId, previousTechnicianId: isOutageExist.technicianId },
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
      customer: { select: { id: true, name: true, email: true, phone: true } },
      technician: { select: { id: true, name: true, phone: true } },
    },
  });

  if (status === OutageStatus.RESOLVED) {
    await sendTemplatedEmail(
      updatedReport.customer.email,
      "Your Outage Has Been Resolved - PowerGridBD",
      "outage-resolved.ejs",
      {
        name: updatedReport.customer.name,
        reportId: updatedReport.id,
        areaName: updatedReport.area.name,
      },
    );
  }

  await logAudit({
    action: "OUTAGE_STATUS_CHANGED",
    entity: "OutageReport",
    entityId: id,
    actorId: user.userId,
    metadata: { from: isOutageExist.status, to: status },
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
