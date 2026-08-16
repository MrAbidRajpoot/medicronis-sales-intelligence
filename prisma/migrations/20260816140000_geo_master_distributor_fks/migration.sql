-- Create geo master tables
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Territory_name_key" ON "Territory"("name");
CREATE UNIQUE INDEX "Area_name_key" ON "Area"("name");
CREATE UNIQUE INDEX "Region_name_key" ON "Region"("name");
CREATE UNIQUE INDEX "Zone_name_key" ON "Zone"("name");

-- Add FK columns on Distributor
ALTER TABLE "Distributor" ADD COLUMN "territoryId" TEXT;
ALTER TABLE "Distributor" ADD COLUMN "areaId" TEXT;
ALTER TABLE "Distributor" ADD COLUMN "regionId" TEXT;
ALTER TABLE "Distributor" ADD COLUMN "zoneId" TEXT;

-- Seed Region rows from legacy enum values and backfill
INSERT INTO "Region" ("id", "name", "isActive", "createdAt", "updatedAt")
SELECT md5(v.label), v.label, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('SOUTH', 'South'),
  ('CENTER_1', 'Center-1'),
  ('CENTER_2', 'Center-2'),
  ('NORTH_1', 'North-1'),
  ('NORTH_2', 'North-2')
) AS v(code, label)
WHERE EXISTS (SELECT 1 FROM "Distributor" d WHERE d."region"::text = v.code);

UPDATE "Distributor" d
SET "regionId" = r.id
FROM "Region" r
WHERE (d."region"::text = 'SOUTH' AND r.name = 'South')
   OR (d."region"::text = 'CENTER_1' AND r.name = 'Center-1')
   OR (d."region"::text = 'CENTER_2' AND r.name = 'Center-2')
   OR (d."region"::text = 'NORTH_1' AND r.name = 'North-1')
   OR (d."region"::text = 'NORTH_2' AND r.name = 'North-2');

-- Seed Zone rows from legacy country enum and backfill
INSERT INTO "Zone" ("id", "name", "isActive", "createdAt", "updatedAt")
SELECT md5(v.label), v.label, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('PAK_1', 'Pak-1'),
  ('PAK_2', 'Pak-2')
) AS v(code, label)
WHERE EXISTS (SELECT 1 FROM "Distributor" d WHERE d."country"::text = v.code);

UPDATE "Distributor" d
SET "zoneId" = z.id
FROM "Zone" z
WHERE (d."country"::text = 'PAK_1' AND z.name = 'Pak-1')
   OR (d."country"::text = 'PAK_2' AND z.name = 'Pak-2');

-- Seed Territory rows from legacy city values and backfill
INSERT INTO "Territory" ("id", "name", "isActive", "createdAt", "updatedAt")
SELECT md5(city), city, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT TRIM("city") AS city
  FROM "Distributor"
  WHERE "city" IS NOT NULL AND TRIM("city") <> ''
) AS cities;

UPDATE "Distributor" d
SET "territoryId" = t.id
FROM "Territory" t
WHERE d."city" IS NOT NULL AND TRIM(d."city") = t.name;

-- Drop legacy geo columns
ALTER TABLE "Distributor" DROP COLUMN "region";
ALTER TABLE "Distributor" DROP COLUMN "country";
ALTER TABLE "Distributor" DROP COLUMN "city";

DROP TYPE IF EXISTS "DistributorRegion";
DROP TYPE IF EXISTS "DistributorCountry";

-- FK indexes + constraints
CREATE INDEX "Distributor_territoryId_idx" ON "Distributor"("territoryId");
CREATE INDEX "Distributor_areaId_idx" ON "Distributor"("areaId");
CREATE INDEX "Distributor_regionId_idx" ON "Distributor"("regionId");
CREATE INDEX "Distributor_zoneId_idx" ON "Distributor"("zoneId");

ALTER TABLE "Distributor" ADD CONSTRAINT "Distributor_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Distributor" ADD CONSTRAINT "Distributor_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Distributor" ADD CONSTRAINT "Distributor_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Distributor" ADD CONSTRAINT "Distributor_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
