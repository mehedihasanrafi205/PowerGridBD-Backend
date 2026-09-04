import { z } from "zod";
import { ScheduleStatus, ScheduleType } from "../../../generated/prisma/enums";

const createScheduleValidationSchema = z.object({
  title: z.string("Title is required" ),
  description: z.string().optional(),
  startTime: z.string("Start time is required" ), 
  endTime: z.string( "End time is required" ),     
  reason: z.string("Reason is required" ),
  type: z.nativeEnum(ScheduleType).optional(),
  feederId: z.string().optional(),
  areaId: z.string().optional(),
}).refine((data) => data.feederId || data.areaId, {
  message: "Either feederId or areaId must be provided",
  path: ["feederId"],
});

const updateScheduleValidationSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  reason: z.string().optional(),
  type: z.nativeEnum(ScheduleType).optional(),
  status: z.nativeEnum(ScheduleStatus).optional(),
  feederId: z.string().optional(),
  areaId: z.string().optional(),
});

const updateScheduleStatusValidationSchema = z.object({
  status: z.nativeEnum(ScheduleStatus,  "Status is required",
  ),
});

export const scheduleValidation = {
  createScheduleValidationSchema,
  updateScheduleValidationSchema,
  updateScheduleStatusValidationSchema
};