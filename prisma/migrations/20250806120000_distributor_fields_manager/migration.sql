-- CreateEnum
CREATE TYPE "DistributorRegion" AS ENUM ('SOUTH', 'CENTER_1', 'CENTER_2', 'NORTH_1', 'NORTH_2');

-- CreateEnum
CREATE TYPE "DistributorCountry" AS ENUM ('PAK_1', 'PAK_2');

-- CreateTable
CREATE TABLE "Manager" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manager_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Manager_name_key" ON "Manager"("name");

-- Preserve old region text as city before changing region column type
ALTER TABLE "Distributor" ADD COLUMN "city" TEXT;
UPDATE "Distributor" SET "city" = "region" WHERE "region" IS NOT NULL;

ALTER TABLE "Distributor" DROP COLUMN "region";

-- Add new typed columns
ALTER TABLE "Distributor" ADD COLUMN "region" "DistributorRegion";
ALTER TABLE "Distributor" ADD COLUMN "country" "DistributorCountry";
ALTER TABLE "Distributor" ADD COLUMN "managerId" TEXT;

-- CreateIndex
CREATE INDEX "Distributor_managerId_idx" ON "Distributor"("managerId");

-- AddForeignKey
ALTER TABLE "Distributor" ADD CONSTRAINT "Distributor_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;
