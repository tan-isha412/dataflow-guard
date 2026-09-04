-- CreateIndex
CREATE INDEX "approvals_organizationId_status_idx" ON "approvals"("organizationId", "status");

-- CreateIndex
CREATE INDEX "audit_events_organizationId_createdAt_idx" ON "audit_events"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "decisions_organizationId_createdAt_idx" ON "decisions"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "destinations_organizationId_idx" ON "destinations"("organizationId");

-- CreateIndex
CREATE INDEX "policies_organizationId_idx" ON "policies"("organizationId");
