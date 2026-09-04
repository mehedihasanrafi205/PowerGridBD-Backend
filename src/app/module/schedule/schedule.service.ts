import { ScheduleStatus, ScheduleType } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";

const createSchedule = async (
  userId: string,
  payload: {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    reason: string;
    type?: ScheduleType;
    feederId?: string;
    areaId?: string;
  },
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

const getAllSchedules = async () => {
  const schedules = await prisma.schedule.findMany({
    include: {
      feeder: true,
      area: true,
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { startTime: "asc" },
  });

  return schedules;
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
