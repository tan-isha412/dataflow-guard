import { createAuditEvent } from "./audit.repository.js";

// The one function every other module calls after a meaningful
// action. Centralizing it here (instead of each module calling
// prisma.auditEvent.create directly) means the audit log's shape
// only needs to change in one place if it ever does.
export async function emitAuditEvent({ organizationId, actorUserId, eventType, metadata = {} }) {
  return createAuditEvent({ organizationId, actorUserId, eventType, metadata });
}