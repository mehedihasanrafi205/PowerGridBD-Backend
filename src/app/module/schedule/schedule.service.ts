import { ScheduleStatus, ScheduleType, UserRole, UserStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import type { IQuery } from "../../interfaces";
import { calculatePagination, buildMeta } from "../../utils/pagination";
import { sendTemplatedEmail } from "../../utils/notify";
import {
  formatDateTime,
  parseDateRangeFilter,
  parseDateTime,
  rangesOverlap,
} from "../../utils/datetime";
import type {
  ICreateSchedulePayload,
  IUpdateSchedulePayload,
} from "./schedule.interface";

const IMMUTABLE_SCHEDULE_STATUSES: ScheduleStatus[] = [
  ScheduleStatus.COMPLETED,
  ScheduleStatus.CANCELLED,
];

const SCHEDULE_TRANSITIONS: Record<ScheduleStatus, ScheduleStatus[]> = {
  [ScheduleStatus.SCHEDULED]: [ScheduleStatus.ONGOING, ScheduleStatus.CANCELLED],
  [ScheduleStatus.ONGOING]: [ScheduleStatus.COMPLETED, ScheduleStatus.CANCELLED],
  [ScheduleStatus.COMPLETED]: [],
  [ScheduleStatus.CANCELLED]: [],
};

const assertValidScheduleTransition = (
  from: ScheduleStatus,
  to: ScheduleStatus,
) => {
  if (from === to) return;
  if (!SCHEDULE_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Invalid schedule status transition from ${from} to ${to}`,
    );
  }
};

interface IScheduleWindow {
  feederId?: string | null;
  areaId?: string | null;
  startTime: Date;
  endTime: Date;
}

/** Feeder ids a schedule window covers (direct + via its area). */
const coveredFeederIds = async (
  feederId?: string | null,
  areaId?: string | null,
): Promise<Set<string>> => {
  const ids = new Set<string>();
  if (feederId) ids.add(feederId);
  if (areaId) {
    const area = await prisma.area.findUnique({
      where: { id: areaId },
      select: { feederId: true },
    });
    if (area) ids.add(area.feederId);
  }
  return ids;
};

/**
 * Reject overlapping coverage: same feeder, same area, or an area
 * schedule overlapping a feeder schedule that covers that area (and vice versa).
 */
const assertNoScheduleConflict = async (
  window: IScheduleWindow,
  excludeId?: string,
) => {
  const feeders = await coveredFeederIds(window.feederId, window.areaId);

  const orConditions: any[] = [];
  if (feeders.size > 0) {
    orConditions.push({ feederId: { in: [...feeders] } });
    orConditions.push({ area: { feederId: { in: [...feeders] } } });
  }
  if (window.areaId) orConditions.push({ areaId: window.areaId });
  if (orConditions.length === 0) return;

  const candidates = await prisma.schedule.findMany({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: orConditions,
      status: { in: [ScheduleStatus.SCHEDULED, ScheduleStatus.ONGOING] },
    },
    select: {
      title: true,
      feederId: true,
      areaId: true,
      startTime: true,
      endTime: true,
      area: { select: { feederId: true } },
    },
  });

  for (const candidate of candidates) {
    const candidateFeeders = new Set<string>();
    if (candidate.feederId) candidateFeeders.add(candidate.feederId);
    if (candidate.area?.feederId) candidateFeeders.add(candidate.area.feederId);

    const sameArea =
      !!window.areaId && candidate.areaId === window.areaId;
    const sharedFeeder = [...feeders].some((id) =>
      candidateFeeders.has(id),
    );

    if (
      (sameArea || sharedFeeder) &&
      rangesOverlap(
        window.startTime,
        window.endTime,
        candidate.startTime,
        candidate.endTime,
      )
    ) {
      throw new AppError(
        httpStatus.CONFLICT,
        `Schedule conflicts with existing schedule "${candidate.title}" covering the same feeder/area`,
      );
    }
  }
};

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

  const startTime = parseDateTime(payload.startTime, "startTime");
  const endTime = parseDateTime(payload.endTime, "endTime");

  if (endTime <= startTime) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "End time must be after start time",
    );
  }

  if (startTime <= new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Schedule start time must be in the future",
    );
  }

  await assertNoScheduleConflict({
    feederId: payload.feederId,
    areaId: payload.areaId,
    startTime,
    endTime,
  });

  const schedule = await prisma.schedule.create({
    data: {
      ...payload,
      startTime,
      endTime,
      createdById: userId,
    },
    include: {
      feeder: true,
      area: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  // Notify customers in the affected area(s). Best-effort and batched
  // so a large subscriber base never blocks schedule creation.
  try {
    const areaConditions: any[] = [];
    if (schedule.areaId) {
      areaConditions.push({ areaId: schedule.areaId });
    }
    if (schedule.feederId) {
      areaConditions.push({ area: { feederId: schedule.feederId } });
    }

    if (areaConditions.length > 0) {
      const subscribers = await prisma.user.findMany({
        where: {
          OR: areaConditions,
          isDeleted: false,
          status: UserStatus.ACTIVE,
          role: UserRole.CUSTOMER,
        },
        select: { name: true, email: true },
      });

      const BATCH_SIZE = 50;
      for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
        const batch = subscribers.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((subscriber) =>
            sendTemplatedEmail(
              subscriber.email,
              "Load Shedding Notice for Your Area - PowerGridBD",
              "schedule-notice.ejs",
              {
                name: subscriber.name,
                title: schedule.title,
                type: schedule.type,
                startTime: formatDateTime(schedule.startTime),
                endTime: formatDateTime(schedule.endTime),
                reason: schedule.reason,
              },
            ),
          ),
        );
      }
    }
  } catch (notifyError) {
    console.error("[notify] schedule notice fan-out failed:", notifyError);
  }

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
    andConditions.push({
      startTime: parseDateRangeFilter(query.from, query.to),
    });
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
const updateSchedule = async (id: string, payload: IUpdateSchedulePayload) => {
  const existing = await prisma.schedule.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");
  }

  if (IMMUTABLE_SCHEDULE_STATUSES.includes(existing.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot update a ${existing.status} schedule`,
    );
  }

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

  const startTime = payload.startTime
    ? parseDateTime(payload.startTime, "startTime")
    : existing.startTime;
  const endTime = payload.endTime
    ? parseDateTime(payload.endTime, "endTime")
    : existing.endTime;

  if (endTime <= startTime) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "End time must be after start time",
    );
  }

  const feederId = payload.feederId ?? existing.feederId;
  const areaId = payload.areaId ?? existing.areaId;

  await assertNoScheduleConflict({ feederId, areaId, startTime, endTime }, id);

  const updatedSchedule = await prisma.schedule.update({
    where: { id },
    data: {
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description }
        : {}),
      ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
      ...(payload.type !== undefined ? { type: payload.type } : {}),
      ...(payload.feederId !== undefined ? { feederId: payload.feederId } : {}),
      ...(payload.areaId !== undefined ? { areaId: payload.areaId } : {}),
      startTime,
      endTime,
    },
    include: {
      feeder: true,
      area: true,
      createdBy: { select: { id: true, name: true } },
    },
  });

  return updatedSchedule;
};

const updateScheduleStatus = async (id: string, status: ScheduleStatus) => {
  const schedule = await prisma.schedule.findUnique({ where: { id } });
  if (!schedule) {
    throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");
  }

  assertValidScheduleTransition(schedule.status, status);

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
  updateSchedule,
  updateScheduleStatus,
  deleteSchedule,
};
