-- CreateEnum
CREATE TYPE "PdfHeaderStructure" AS ENUM ('single_row', 'grouped_two_row', 'title_block_then_table');

-- CreateTable
CREATE TABLE "PdfFormat" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "headerStructure" "PdfHeaderStructure" NOT NULL,
    "defaultConfig" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfFormat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PdfFormat_code_key" ON "PdfFormat"("code");

-- CreateIndex
CREATE INDEX "PdfFormat_family_idx" ON "PdfFormat"("family");

-- CreateIndex
CREATE INDEX "PdfFormat_isActive_idx" ON "PdfFormat"("isActive");

-- AlterTable: add nullable pdfFormatId first for backfill
ALTER TABLE "Distributor" ADD COLUMN "pdfFormatId" TEXT;

-- CreateIndex
CREATE INDEX "Distributor_pdfFormatId_idx" ON "Distributor"("pdfFormatId");

-- AddForeignKey
ALTER TABLE "Distributor" ADD CONSTRAINT "Distributor_pdfFormatId_fkey" FOREIGN KEY ("pdfFormatId") REFERENCES "PdfFormat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed placeholder format so existing distributors can be backfilled by prisma db seed
INSERT INTO "PdfFormat" ("id", "code", "name", "family", "headerStructure", "defaultConfig", "isActive", "createdAt", "updatedAt")
VALUES (
    'fmt-placeholder-a',
    'fmt-a-ssr-stock-return',
    'SSR Stock & Return (placeholder)',
    'A',
    'grouped_two_row',
    '{"headerStructure":"grouped_two_row","fields":{}}'::jsonb,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

UPDATE "Distributor" SET "pdfFormatId" = 'fmt-placeholder-a' WHERE "pdfFormatId" IS NULL;

ALTER TABLE "Distributor" ALTER COLUMN "pdfFormatId" SET NOT NULL;
