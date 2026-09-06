import { z } from "zod";
import { ScheduleStatus, ScheduleType } from "../../../generated/prisma/enums";

const dateTimeString = (field: string) =>
  z.string(`Invalid ${field}: must be an ISO-8601 date-time`).refine(
    (value) => !Number.isNaN(Date.parse(value)),
    { message: `Invalid ${field}: must be a valid ISO-8601 date-time` },
  );

const createScheduleValidationSchema = z.object({
  title: z.string("Title is required" ),
  description: z.string().optional(),
  startTime: dateTimeString("start time"),
  endTime: dateTimeString("end time"),
  reason: z.string("Reason is required" ),
  type: z.nativeEnum(ScheduleType).optional(),
  feederId: z.string().optional(),
  areaId: z.string().optional(),
}).refine((data) => data.feederId || data.areaId, {
  message: "Either feederId or areaId must be provided",
  path: ["feederId"],
}).refine((data) => new Date(data.endTime) > new Date(data.startTime), {
  message: "End time must be after start time",
  path: ["endTime"],
});

const updateScheduleValidationSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  startTime: dateTimeString("start time").optional(),
  endTime: dateTimeString("end time").optional(),
  reason: z.string().optional(),
  type: z.nativeEnum(ScheduleType).optional(),
  feederId: z.string().optional(),
  areaId: z.string().optional(),
}).refine(
  (data) =>
    !data.startTime ||
    !data.endTime ||
    new Date(data.endTime) > new Date(data.startTime),
  {
    message: "End time must be after start time",
    path: ["endTime"],
  },
);

const updateScheduleStatusValidationSchema = z.object({
  status: z.nativeEnum(ScheduleStatus,  "Status is required",
  ),
});

export const scheduleValidation = {
  createScheduleValidationSchema,
  updateScheduleValidationSchema,
  updateScheduleStatusValidationSchema
};