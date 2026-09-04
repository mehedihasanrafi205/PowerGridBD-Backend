import { ScheduleStatus, ScheduleType } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import type { IQuery } from "../../interfaces";
import { calculatePagination, buildMeta } from "../../utils/pagination";
import type { ICreateSchedulePayload } from "./schedule.interface";

const createSchedule = async (
  userId: string,
  payload: ICreateSchedulePayload,
) => {
  if (payload.feederId) {
    const feeder = await prisma.feeder.findUnique({
      where: { id: payload.feederId },
    });
    if (!feeder) throw new AppError(httpStatus.NOT_FOUND, "Feeder not found");
  }

  if (payload.areaId) {
    const area = await prisma.area.findUnique({
      where: { id: payload.areaId },
    });
    if (!area) throw new AppError(httpStatus.NOT_FOUND, "Area not found");
  }

  const schedule = await prisma.schedule.create({
    data: {
      ...payload,
      startTime: new Date(payload.startTime),
      endTime: new Date(payload.endTime),
      createdById: userId,
    },
    include: {
      feeder: true,
      area: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return schedule;
};

const getAllSchedules = async (query: IQuery = {}) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(query, {
    sortBy: "startTime",
  });

  const andConditions: any[] = [];

  if (query.searchTerm) {
    const term = String(query.searchTerm);
    andConditions.push({
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { reason: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  if (query.status) {
    andConditions.push({ status: query.status as ScheduleStatus });
  }

  if (query.type) {
    andConditions.push({ type: query.type as ScheduleType });
  }

  if (query.feederId) {
    andConditions.push({ feederId: String(query.feederId) });
  }

  if (query.areaId) {
    andConditions.push({ areaId: String(query.areaId) });
  }

  if (query.from || query.to) {
    const startTime: { gte?: Date; lte?: Date } = {};
    if (query.from) startTime.gte = new Date(String(query.from));
    if (query.to) startTime.lte = new Date(String(query.to));
    andConditions.push({ startTime });
  }

  const where = andConditions.length > 0 ? { AND: andConditions } : {};

  const [schedules, total] = await Promise.all([
    prisma.schedule.findMany({
      where,
      include: {
        feeder: true,
        area: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.schedule.count({ where }),
  ]);

  return { data: schedules, meta: buildMeta(total, page, limit) };
};

const getSingleSchedule = async (id: string) => {
  const schedule = await prisma.schedule.findUnique({
    where: { id },
    include: {
      feeder: true,
      area: true,
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!schedule) {
    throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");
  }

  return schedule;
};
const updateScheduleStatus = async (id: string, status: ScheduleStatus) => {
  const schedule = await prisma.schedule.findUnique({ where: { id } });
  if (!schedule) {
    throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");
  }

  const updatedSchedule = await prisma.schedule.update({
    where: { id },
    data: { status },
    include: {
      feeder: true,
      area: true,
      createdBy: { select: { id: true, name: true } },
    },
  });

  return updatedSchedule;
};

const deleteSchedule = async (id: string) => {
  const schedule = await prisma.schedule.findUnique({ where: { id } });
  if (!schedule) {
    throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");
  }

  return await prisma.schedule.delete({ where: { id } });
};

export const scheduleService = {
  createSchedule,
  getAllSchedules,
  getSingleSchedule,
  updateScheduleStatus,
  deleteSchedule,
};
