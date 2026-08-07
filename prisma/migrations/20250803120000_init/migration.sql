-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'EXTRACTED', 'REVIEW_REQUIRED', 'APPROVED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExtractionRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExtractedRowStatus" AS ENUM ('PENDING', 'MATCHED', 'UNMATCHED', 'REVIEWED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SalesBatchStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'EXPORTED');

-- CreateEnum
CREATE TYPE "SsrReportStatus" AS ENUM ('GENERATING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Distributor" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Distributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorTemplate" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'EA',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAlias" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,

    CONSTRAINT "ProductAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorProductMapping" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "rawProductText" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorProductMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "distributorId" TEXT,
    "templateId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionRun" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" "ExtractionRunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedRow" (
    "id" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "rawProductText" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2),
    "lineTotal" DECIMAL(12,2),
    "status" "ExtractedRowStatus" NOT NULL DEFAULT 'PENDING',
    "productId" TEXT,
    "distributorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesBatch" (
    "id" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "documentId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "SalesBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "totalQuantity" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesLine" (
    "id" TEXT NOT NULL,
    "salesBatchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "extractedRowId" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2),
    "lineTotal" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsrReport" (
    "id" TEXT NOT NULL,
    "salesBatchId" TEXT NOT NULL,
    "filePath" TEXT,
    "status" "SsrReportStatus" NOT NULL DEFAULT 'GENERATING',
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsrReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Distributor_code_key" ON "Distributor"("code");

-- CreateIndex
CREATE INDEX "DistributorTemplate_distributorId_idx" ON "DistributorTemplate"("distributorId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "ProductAlias_alias_idx" ON "ProductAlias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAlias_productId_alias_key" ON "ProductAlias"("productId", "alias");

-- CreateIndex
CREATE INDEX "DistributorProductMapping_distributorId_rawProductText_idx" ON "DistributorProductMapping"("distributorId", "rawProductText");

-- CreateIndex
CREATE UNIQUE INDEX "DistributorProductMapping_distributorId_rawProductText_key" ON "DistributorProductMapping"("distributorId", "rawProductText");

-- CreateIndex
CREATE INDEX "Document_fileHash_idx" ON "Document"("fileHash");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Document_distributorId_idx" ON "Document"("distributorId");

-- CreateIndex
CREATE INDEX "ExtractionRun_documentId_idx" ON "ExtractionRun"("documentId");

-- CreateIndex
CREATE INDEX "ExtractionRun_status_idx" ON "ExtractionRun"("status");

-- CreateIndex
CREATE INDEX "ExtractedRow_extractionRunId_idx" ON "ExtractedRow"("extractionRunId");

-- CreateIndex
CREATE INDEX "ExtractedRow_status_idx" ON "ExtractedRow"("status");

-- CreateIndex
CREATE INDEX "ExtractedRow_distributorId_rawProductText_idx" ON "ExtractedRow"("distributorId", "rawProductText");

-- CreateIndex
CREATE UNIQUE INDEX "SalesBatch_batchCode_key" ON "SalesBatch"("batchCode");

-- CreateIndex
CREATE INDEX "SalesBatch_distributorId_idx" ON "SalesBatch"("distributorId");

-- CreateIndex
CREATE INDEX "SalesBatch_periodStart_periodEnd_idx" ON "SalesBatch"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "SalesBatch_status_idx" ON "SalesBatch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalesLine_extractedRowId_key" ON "SalesLine"("extractedRowId");

-- CreateIndex
CREATE INDEX "SalesLine_salesBatchId_idx" ON "SalesLine"("salesBatchId");

-- CreateIndex
CREATE INDEX "SalesLine_productId_idx" ON "SalesLine"("productId");

-- CreateIndex
CREATE INDEX "SsrReport_salesBatchId_idx" ON "SsrReport"("salesBatchId");

-- CreateIndex
CREATE INDEX "SsrReport_status_idx" ON "SsrReport"("status");

-- AddForeignKey
ALTER TABLE "DistributorTemplate" ADD CONSTRAINT "DistributorTemplate_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAlias" ADD CONSTRAINT "ProductAlias_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorProductMapping" ADD CONSTRAINT "DistributorProductMapping_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorProductMapping" ADD CONSTRAINT "DistributorProductMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DistributorTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionRun" ADD CONSTRAINT "ExtractionRun_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedRow" ADD CONSTRAINT "ExtractedRow_extractionRunId_fkey" FOREIGN KEY ("extractionRunId") REFERENCES "ExtractionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedRow" ADD CONSTRAINT "ExtractedRow_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesBatch" ADD CONSTRAINT "SalesBatch_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesBatch" ADD CONSTRAINT "SalesBatch_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesBatch" ADD CONSTRAINT "SalesBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLine" ADD CONSTRAINT "SalesLine_salesBatchId_fkey" FOREIGN KEY ("salesBatchId") REFERENCES "SalesBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLine" ADD CONSTRAINT "SalesLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLine" ADD CONSTRAINT "SalesLine_extractedRowId_fkey" FOREIGN KEY ("extractedRowId") REFERENCES "ExtractedRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsrReport" ADD CONSTRAINT "SsrReport_salesBatchId_fkey" FOREIGN KEY ("salesBatchId") REFERENCES "SalesBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsrReport" ADD CONSTRAINT "SsrReport_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
