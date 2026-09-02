import { z } from "zod";

const createZoneValidationSchema = z.object({
  name: z.string("Zone name is required"),
  description: z.string().optional(),
});

const updateZoneValidationSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
});

const createSubstationValidationSchema = z.object({
  name: z.string("Substation name is required"),
  zoneId: z.string("Zone ID is required"),
});

const createFeederValidationSchema = z.object({
  name: z.string("Feeder name is required"),
  substationId: z.string("Substation ID is required"),
});

export const gridValidation = {
  createZoneValidationSchema,
  updateZoneValidationSchema,
  createSubstationValidationSchema,
  createFeederValidationSchema,
};
