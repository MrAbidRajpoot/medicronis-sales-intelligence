-- CreateTable
CREATE TABLE "ProductTarget" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "territoryId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductTarget_year_month_idx" ON "ProductTarget"("year", "month");

-- CreateIndex
CREATE INDEX "ProductTarget_productId_year_month_idx" ON "ProductTarget"("productId", "year", "month");

-- CreateIndex
CREATE INDEX "ProductTarget_managerId_idx" ON "ProductTarget"("managerId");

-- CreateIndex
CREATE INDEX "ProductTarget_territoryId_idx" ON "ProductTarget"("territoryId");

-- CreateIndex
CREATE INDEX "ProductTarget_areaId_idx" ON "ProductTarget"("areaId");

-- CreateIndex
CREATE INDEX "ProductTarget_regionId_idx" ON "ProductTarget"("regionId");

-- CreateIndex
CREATE INDEX "ProductTarget_zoneId_idx" ON "ProductTarget"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTarget_productId_year_month_territoryId_areaId_regionId_zoneId_key" ON "ProductTarget"("productId", "year", "month", "territoryId", "areaId", "regionId", "zoneId");

-- AddForeignKey
ALTER TABLE "ProductTarget" ADD CONSTRAINT "ProductTarget_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTarget" ADD CONSTRAINT "ProductTarget_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTarget" ADD CONSTRAINT "ProductTarget_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTarget" ADD CONSTRAINT "ProductTarget_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTarget" ADD CONSTRAINT "ProductTarget_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTarget" ADD CONSTRAINT "ProductTarget_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
