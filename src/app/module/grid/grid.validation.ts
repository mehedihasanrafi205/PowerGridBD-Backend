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
const updateSubstationValidationSchema = z.object({
  name: z.string().optional(),
  zoneId: z.string().optional(),
});

const createFeederValidationSchema = z.object({
  name: z.string("Feeder name is required"),
  substationId: z.string("Substation ID is required"),
});

const updateFeederValidationSchema = z.object({
  name: z.string().optional(),
  substationId: z.string().optional(),
});

const createAreaValidationSchema = z.object({
  name: z.string("Area name is required"),
  feederId: z.string("Feeder ID is required"),
});

const updateAreaValidationSchema = z.object({
  name: z.string().optional(),
  feederId: z.string().optional(),
});

export const gridValidation = {
  createZoneValidationSchema,
  updateZoneValidationSchema,
  createSubstationValidationSchema,
  updateSubstationValidationSchema,
  createFeederValidationSchema,
  updateFeederValidationSchema,
  createAreaValidationSchema,
  updateAreaValidationSchema,
};
