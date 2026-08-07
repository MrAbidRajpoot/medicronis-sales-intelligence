-- AlterEnum
ALTER TYPE "DocumentStatus" ADD VALUE 'TEMPLATE_MISMATCH';

-- AlterTable
ALTER TABLE "DistributorTemplate" ADD COLUMN "lastSuccessfulRowCount" INTEGER;
