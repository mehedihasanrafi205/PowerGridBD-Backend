import { prisma } from "../lib/prisma";

export interface IAuditEvent {
  action: string;
  entity: string;
  entityId?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Best-effort audit log writer. Never throws — audit must not break
 * the business flow it records.
 */
export const logAudit = async (event: IAuditEvent): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        action: event.action,
        entity: event.entity,
        entityId: event.entityId,
        actorId: event.actorId,
        metadata: (event.metadata ?? {}) as Record<string, unknown> as any,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write audit log:", error);
  }
};
