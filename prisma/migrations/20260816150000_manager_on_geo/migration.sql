-- Ensure Vacant manager exists
INSERT INTO "Manager" ("id", "name", "isActive", "createdAt", "updatedAt")
SELECT md5('Vacant'), 'Vacant', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Manager" WHERE name = 'Vacant');

-- Add managerId to geo tables (nullable first for backfill)
ALTER TABLE "Territory" ADD COLUMN "managerId" TEXT;
ALTER TABLE "Area" ADD COLUMN "managerId" TEXT;
ALTER TABLE "Region" ADD COLUMN "managerId" TEXT;
ALTER TABLE "Zone" ADD COLUMN "managerId" TEXT;

-- Prefer existing distributor managers onto their linked geo rows
UPDATE "Territory" t
SET "managerId" = sub."managerId"
FROM (
  SELECT DISTINCT ON ("territoryId") "territoryId", "managerId"
  FROM "Distributor"
  WHERE "territoryId" IS NOT NULL AND "managerId" IS NOT NULL
  ORDER BY "territoryId", "updatedAt" DESC
) AS sub
WHERE t.id = sub."territoryId";

UPDATE "Area" a
SET "managerId" = sub."managerId"
FROM (
  SELECT DISTINCT ON ("areaId") "areaId", "managerId"
  FROM "Distributor"
  WHERE "areaId" IS NOT NULL AND "managerId" IS NOT NULL
  ORDER BY "areaId", "updatedAt" DESC
) AS sub
WHERE a.id = sub."areaId";

UPDATE "Region" r
SET "managerId" = sub."managerId"
FROM (
  SELECT DISTINCT ON ("regionId") "regionId", "managerId"
  FROM "Distributor"
  WHERE "regionId" IS NOT NULL AND "managerId" IS NOT NULL
  ORDER BY "regionId", "updatedAt" DESC
) AS sub
WHERE r.id = sub."regionId";

UPDATE "Zone" z
SET "managerId" = sub."managerId"
FROM (
  SELECT DISTINCT ON ("zoneId") "zoneId", "managerId"
  FROM "Distributor"
  WHERE "zoneId" IS NOT NULL AND "managerId" IS NOT NULL
  ORDER BY "zoneId", "updatedAt" DESC
) AS sub
WHERE z.id = sub."zoneId";

-- Anything still missing gets Vacant
UPDATE "Territory" SET "managerId" = (SELECT id FROM "Manager" WHERE name = 'Vacant' LIMIT 1) WHERE "managerId" IS NULL;
UPDATE "Area" SET "managerId" = (SELECT id FROM "Manager" WHERE name = 'Vacant' LIMIT 1) WHERE "managerId" IS NULL;
UPDATE "Region" SET "managerId" = (SELECT id FROM "Manager" WHERE name = 'Vacant' LIMIT 1) WHERE "managerId" IS NULL;
UPDATE "Zone" SET "managerId" = (SELECT id FROM "Manager" WHERE name = 'Vacant' LIMIT 1) WHERE "managerId" IS NULL;

-- Make managerId required
ALTER TABLE "Territory" ALTER COLUMN "managerId" SET NOT NULL;
ALTER TABLE "Area" ALTER COLUMN "managerId" SET NOT NULL;
ALTER TABLE "Region" ALTER COLUMN "managerId" SET NOT NULL;
ALTER TABLE "Zone" ALTER COLUMN "managerId" SET NOT NULL;

CREATE INDEX "Territory_managerId_idx" ON "Territory"("managerId");
CREATE INDEX "Area_managerId_idx" ON "Area"("managerId");
CREATE INDEX "Region_managerId_idx" ON "Region"("managerId");
CREATE INDEX "Zone_managerId_idx" ON "Zone"("managerId");

ALTER TABLE "Territory" ADD CONSTRAINT "Territory_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Area" ADD CONSTRAINT "Area_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Region" ADD CONSTRAINT "Region_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Remove manager from distributors
ALTER TABLE "Distributor" DROP CONSTRAINT IF EXISTS "Distributor_managerId_fkey";
DROP INDEX IF EXISTS "Distributor_managerId_idx";
ALTER TABLE "Distributor" DROP COLUMN IF EXISTS "managerId";
