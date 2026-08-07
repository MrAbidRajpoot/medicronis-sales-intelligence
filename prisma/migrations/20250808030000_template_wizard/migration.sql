-- AlterTable: optional pdfFormatId on Distributor
ALTER TABLE "Distributor" ALTER COLUMN "pdfFormatId" DROP NOT NULL;

-- AlterTable: wizard completion timestamp on DistributorTemplate
ALTER TABLE "DistributorTemplate" ADD COLUMN "configuredAt" TIMESTAMP(3);

-- Grandfather existing active templates as wizard-configured
UPDATE "DistributorTemplate"
SET "configuredAt" = COALESCE("updatedAt", "createdAt")
WHERE "isActive" = true AND "config" IS NOT NULL;
