import { z } from "zod";

const createZoneValidationSchema = z.object({
  body: z.object({
    name: z.string("Zone name is required"),
    description: z.string().optional(),
  }),
});

const updateZoneValidationSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const gridValidation = {
  createZoneValidationSchema,
  updateZoneValidationSchema,
};
