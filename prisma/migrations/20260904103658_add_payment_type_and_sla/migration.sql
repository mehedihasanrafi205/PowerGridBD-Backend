/*
  Warnings:

  - Added the required column `type` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('PRIORITY_RESTORATION', 'SLA_SUBSCRIPTION');

-- AlterTable
ALTER TABLE "outage_reports" ADD COLUMN     "isPriority" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "type" "PaymentType" NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "slaActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slaExpiryDate" TIMESTAMP(3);
