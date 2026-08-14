-- CreateEnum
CREATE TYPE "DistributorInputMode" AS ENUM ('BOTH', 'EXCEL_ONLY');

-- AlterTable
ALTER TABLE "Distributor" ADD COLUMN "inputMode" "DistributorInputMode" NOT NULL DEFAULT 'BOTH';

-- AlterTable
ALTER TABLE "DistributorTemplate" ADD COLUMN "excelConfig" JSONB,
ADD COLUMN "excelConfiguredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Distributor_inputMode_idx" ON "Distributor"("inputMode");
