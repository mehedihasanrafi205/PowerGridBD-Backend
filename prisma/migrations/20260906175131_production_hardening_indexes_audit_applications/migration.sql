-- Scoped name uniqueness for grid hierarchy
ALTER TABLE "substations" ADD CONSTRAINT "substations_name_zoneId_key" UNIQUE ("name", "zoneId");
ALTER TABLE "feeders" ADD CONSTRAINT "feeders_name_substationId_key" UNIQUE ("name", "substationId");
ALTER TABLE "areas" ADD CONSTRAINT "areas_name_feederId_key" UNIQUE ("name", "feederId");

-- Composite and FK indexes for hot query paths
CREATE INDEX "outage_reports_status_reportedAt_idx" ON "outage_reports"("status", "reportedAt");
CREATE INDEX "outage_reports_customerId_idx" ON "outage_reports"("customerId");
CREATE INDEX "outage_reports_areaId_idx" ON "outage_reports"("areaId");
CREATE INDEX "outage_reports_technicianId_idx" ON "outage_reports"("technicianId");
CREATE INDEX "schedules_startTime_status_idx" ON "schedules"("startTime", "status");
CREATE INDEX "schedules_feederId_idx" ON "schedules"("feederId");
CREATE INDEX "schedules_areaId_idx" ON "schedules"("areaId");
CREATE INDEX "payments_userId_status_idx" ON "payments"("userId", "status");
CREATE INDEX "payments_outageReportId_idx" ON "payments"("outageReportId");
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- Outage assignment timestamp (powers assignment-time KPI)
ALTER TABLE "outage_reports" ADD COLUMN     "assignedAt" TIMESTAMP(3);

-- Audit trail
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_entity_createdAt_idx" ON "audit_logs"("entity", "createdAt");
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Technician onboarding applications
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "technician_applications" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "experience" TEXT,
    "bio" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "technician_applications_userId_key" ON "technician_applications"("userId");
CREATE INDEX "technician_applications_status_idx" ON "technician_applications"("status");
CREATE INDEX "technician_applications_email_idx" ON "technician_applications"("email");
ALTER TABLE "technician_applications" ADD CONSTRAINT "technician_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SLA warning tracking (one warning per expiry cycle)
ALTER TABLE "users" ADD COLUMN     "slaWarningSentAt" TIMESTAMP(3);
