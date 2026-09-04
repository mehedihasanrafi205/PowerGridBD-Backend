import type { OutageStatus } from "../../../generated/prisma/enums";

export interface ICreateOutageReportPayload {
  description: string;
  areaId: string;
}

export interface IUpdateOutageStatusPayload {
  status?: OutageStatus;
  technicianId?: string;
}

export interface IAssignTechnicianPayload {
  technicianId: string;
}
