import { z } from "zod";

// Query-string schemas (parsed manually in the controller since
// validateRequest only covers req.body). Exported for reuse and docs.
export const trendsQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).optional().default(30),
});

export const auditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  entity: z.string().optional(),
  action: z.string().optional(),
});

export const slaSubscribePayloadSchema = z.object({
  planId: z.string().uuid("Invalid plan ID"),
});

export const analyticsValidation = {
  trendsQuerySchema,
  auditLogsQuerySchema,
  slaSubscribePayloadSchema,
};