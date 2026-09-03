-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('MAINTENANCE', 'LOAD_SHEDDING', 'EMERGENCY_REPAIR');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "schedules" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "status" "ScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN     "type" "ScheduleType" NOT NULL DEFAULT 'LOAD_SHEDDING';

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
