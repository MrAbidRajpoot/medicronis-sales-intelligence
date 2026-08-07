-- CreateEnum
CREATE TYPE "SsrViewType" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- AlterTable: Document.reportDate (backfill from createdAt)
ALTER TABLE "Document" ADD COLUMN "reportDate" DATE;
UPDATE "Document" SET "reportDate" = DATE("createdAt");
ALTER TABLE "Document" ALTER COLUMN "reportDate" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Document_distributorId_reportDate_idx" ON "Document"("distributorId", "reportDate");

-- CreateTable
CREATE TABLE "DailySalesFact" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "saleDate" DATE NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2),
    "salesValue" DECIMAL(14,2),
    "closingStock" DECIMAL(12,2),
    "returnsQty" DECIMAL(12,2),
    "sourceDocumentId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySalesFact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailySalesFact_distributorId_productId_saleDate_key" ON "DailySalesFact"("distributorId", "productId", "saleDate");
CREATE INDEX "DailySalesFact_saleDate_idx" ON "DailySalesFact"("saleDate");
CREATE INDEX "DailySalesFact_distributorId_saleDate_idx" ON "DailySalesFact"("distributorId", "saleDate");
CREATE INDEX "DailySalesFact_sourceDocumentId_idx" ON "DailySalesFact"("sourceDocumentId");

-- AddForeignKey
ALTER TABLE "DailySalesFact" ADD CONSTRAINT "DailySalesFact_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailySalesFact" ADD CONSTRAINT "DailySalesFact_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailySalesFact" ADD CONSTRAINT "DailySalesFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: SsrReport (nullable salesBatchId, add viewType + asOfDate)
ALTER TABLE "SsrReport" ALTER COLUMN "salesBatchId" DROP NOT NULL;
ALTER TABLE "SsrReport" ADD COLUMN "viewType" "SsrViewType";
ALTER TABLE "SsrReport" ADD COLUMN "asOfDate" DATE;

-- CreateIndex
CREATE INDEX "SsrReport_asOfDate_viewType_idx" ON "SsrReport"("asOfDate", "viewType");
