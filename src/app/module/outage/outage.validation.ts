import { z } from "zod";
import { OutageStatus } from "../../../generated/prisma/enums";

const createOutageReportValidationSchema = z.object({
  description: z.string("Description is required"),
  areaId: z.string("Area ID is required"),
});

const updateOutageStatusValidationSchema = z.object({
  status: z.nativeEnum(OutageStatus).optional(),
  technicianId: z.string().optional(),
});

const assignTechnicianValidationSchema = z.object({
  technicianId: z.string("Technician ID is required"),
});

const getAllOutageReportsQueryValidationSchema = z.object({
  searchTerm: z.string().optional(),
  status: z.union([z.nativeEnum(OutageStatus), z.array(z.nativeEnum(OutageStatus))]).optional(),
  areaId: z.union([z.string(), z.array(z.string())]).optional(),
  feederId: z.string().optional(),
  substationId: z.string().optional(),
  zoneId: z.string().optional(),
  isPriority: z.union([z.boolean(), z.string()]).optional(),
  customerId: z.string().optional(),
  technicianId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  assignedFrom: z.string().optional(),
  assignedTo: z.string().optional(),
  resolvedFrom: z.string().optional(),
  resolvedTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const outageValidation = {
  createOutageReportValidationSchema,
  updateOutageStatusValidationSchema,
  assignTechnicianValidationSchema,
  getAllOutageReportsQueryValidationSchema,
};
