import { prisma } from "@/lib/prisma";
import { ensureVacantManagerId } from "@/lib/manager-helpers";

type GeoDelegate = {
  findUnique: (args: { where: { name: string } }) => Promise<{ id: string } | null>;
  create: (args: {
    data: { name: string; managerId: string };
  }) => Promise<{ id: string }>;
  findFirst: (args: { where: { id: string; isActive?: boolean } }) => Promise<{ id: string } | null>;
};

/** Find-or-create a geo master row by name (Excel import). New rows get Vacant manager. */
export async function resolveGeoIdByName(
  delegate: GeoDelegate,
  name?: string | null
): Promise<string | null | undefined> {
  if (name === undefined) return undefined;
  if (name === null) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;

  const existing = await delegate.findUnique({ where: { name: trimmed } });
  if (existing) return existing.id;
  const vacantId = await ensureVacantManagerId();
  const created = await delegate.create({
    data: { name: trimmed, managerId: vacantId },
  });
  return created.id;
}

export async function assertActiveGeoId(
  delegate: GeoDelegate,
  id: string | null | undefined,
  label: string
): Promise<string | null> {
  if (id === undefined || id === null || id === "") return null;
  const row = await delegate.findFirst({ where: { id, isActive: true } });
  if (!row) {
    throw new Error(`Invalid or inactive ${label}`);
  }
  return row.id;
}

export const territoryDelegate = {
  findUnique: (args: { where: { name: string } }) => prisma.territory.findUnique(args),
  create: (args: { data: { name: string; managerId: string } }) => prisma.territory.create(args),
  findFirst: (args: { where: { id: string; isActive?: boolean } }) =>
    prisma.territory.findFirst(args),
};

export const areaDelegate = {
  findUnique: (args: { where: { name: string } }) => prisma.area.findUnique(args),
  create: (args: { data: { name: string; managerId: string } }) => prisma.area.create(args),
  findFirst: (args: { where: { id: string; isActive?: boolean } }) =>
    prisma.area.findFirst(args),
};

export const regionDelegate = {
  findUnique: (args: { where: { name: string } }) => prisma.region.findUnique(args),
  create: (args: { data: { name: string; managerId: string } }) => prisma.region.create(args),
  findFirst: (args: { where: { id: string; isActive?: boolean } }) =>
    prisma.region.findFirst(args),
};

export const zoneDelegate = {
  findUnique: (args: { where: { name: string } }) => prisma.zone.findUnique(args),
  create: (args: { data: { name: string; managerId: string } }) => prisma.zone.create(args),
  findFirst: (args: { where: { id: string; isActive?: boolean } }) =>
    prisma.zone.findFirst(args),
};

export const distributorGeoInclude = {
  territory: {
    select: {
      id: true,
      name: true,
      manager: { select: { id: true, name: true } },
    },
  },
  area: {
    select: {
      id: true,
      name: true,
      manager: { select: { id: true, name: true } },
    },
  },
  region: {
    select: {
      id: true,
      name: true,
      manager: { select: { id: true, name: true } },
    },
  },
  zone: {
    select: {
      id: true,
      name: true,
      manager: { select: { id: true, name: true } },
    },
  },
} as const;

export type GeoRef = {
  id: string;
  name: string;
  manager?: { id: string; name: string } | null;
} | null;

export function mapDistributorGeo(d: {
  territoryId: string | null;
  areaId: string | null;
  regionId: string | null;
  zoneId: string | null;
  territory?: GeoRef;
  area?: GeoRef;
  region?: GeoRef;
  zone?: GeoRef;
}) {
  return {
    territoryId: d.territoryId,
    territoryName: d.territory?.name ?? null,
    areaId: d.areaId,
    areaName: d.area?.name ?? null,
    regionId: d.regionId,
    regionName: d.region?.name ?? null,
    zoneId: d.zoneId,
    zoneName: d.zone?.name ?? null,
  };
}
