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

export const outageValidation = {
  createOutageReportValidationSchema,
  updateOutageStatusValidationSchema,
};
