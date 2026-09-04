import type {
  ScheduleStatus,
  ScheduleType,
} from "../../../generated/prisma/enums";

export interface ICreateSchedulePayload {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  reason: string;
  type?: ScheduleType;
  feederId?: string;
  areaId?: string;
}

export interface IUpdateSchedulePayload {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
  type?: ScheduleType;
  status?: ScheduleStatus;
  feederId?: string;
  areaId?: string;
}
