-- CreateTable
CREATE TABLE "Manufacturer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Manufacturer_name_key" ON "Manufacturer"("name");

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "unit";

ALTER TABLE "Product" ADD COLUMN "composition" TEXT;
ALTER TABLE "Product" ADD COLUMN "manufacturerId" TEXT;
ALTER TABLE "Product" ADD COLUMN "shipperSize" INTEGER;
ALTER TABLE "Product" ADD COLUMN "mrp" DECIMAL(12,2);
ALTER TABLE "Product" ADD COLUMN "tp" DECIMAL(12,2);
ALTER TABLE "Product" ADD COLUMN "oldSp" DECIMAL(12,2);
ALTER TABLE "Product" ADD COLUMN "newSp" DECIMAL(12,2);
ALTER TABLE "Product" ADD COLUMN "netPrice" DECIMAL(12,2);
ALTER TABLE "Product" ADD COLUMN "tax" DECIMAL(12,2);
ALTER TABLE "Product" ADD COLUMN "netPriceWith1Pct" DECIMAL(12,2);
ALTER TABLE "Product" ADD COLUMN "bonus" TEXT;

-- CreateIndex
CREATE INDEX "Product_manufacturerId_idx" ON "Product"("manufacturerId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
