import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const targetInclude = {
  product: { select: { id: true, sku: true, name: true } },
  territory: { select: { id: true, name: true, managerId: true } },
  area: { select: { id: true, name: true, managerId: true } },
  region: { select: { id: true, name: true, managerId: true } },
  zone: { select: { id: true, name: true, managerId: true } },
  manager: { select: { id: true, name: true } },
} as const;

export type ProductTargetRow = Prisma.ProductTargetGetPayload<{ include: typeof targetInclude }>;

export function mapProductTarget(row: ProductTargetRow) {
  return {
    id: row.id,
    productId: row.productId,
    productSku: row.product.sku,
    productName: row.product.name,
    year: row.year,
    month: row.month,
    territoryId: row.territoryId,
    territoryName: row.territory.name,
    areaId: row.areaId,
    areaName: row.area.name,
    regionId: row.regionId,
    regionName: row.region.name,
    zoneId: row.zoneId,
    zoneName: row.zone.name,
    managerId: row.managerId,
    managerName: row.manager.name,
    quantity: Number(row.quantity),
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function parseYear(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) return null;
  return n;
}

export function parseMonth(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 12) return null;
  return n;
}

export function parseQuantity(value: unknown): Prisma.Decimal | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return new Prisma.Decimal(n);
}

/**
 * Manager is valid only when territory, area, region, and zone all share the same managerId.
 * Returns that shared manager id, or an error message.
 */
export async function resolveMatchedManagerId(input: {
  territoryId: string;
  areaId: string;
  regionId: string;
  zoneId: string;
  managerId?: string | null;
}): Promise<{ managerId: string } | { error: string; status: number }> {
  const [territory, area, region, zone] = await Promise.all([
    prisma.territory.findUnique({ where: { id: input.territoryId }, select: { id: true, managerId: true, isActive: true } }),
    prisma.area.findUnique({ where: { id: input.areaId }, select: { id: true, managerId: true, isActive: true } }),
    prisma.region.findUnique({ where: { id: input.regionId }, select: { id: true, managerId: true, isActive: true } }),
    prisma.zone.findUnique({ where: { id: input.zoneId }, select: { id: true, managerId: true, isActive: true } }),
  ]);

  if (!territory) return { error: "Territory not found", status: 400 };
  if (!area) return { error: "Area not found", status: 400 };
  if (!region) return { error: "Region not found", status: 400 };
  if (!zone) return { error: "Zone not found", status: 400 };

  if (!territory.isActive || !area.isActive || !region.isActive || !zone.isActive) {
    return { error: "Territory, area, region, and zone must all be active", status: 400 };
  }

  const managerIds = [territory.managerId, area.managerId, region.managerId, zone.managerId];
  const unique = new Set(managerIds);
  if (unique.size !== 1) {
    return {
      error:
        "Manager must match territory, area, region, and zone. Assign the same manager to all four on the Managers page first.",
      status: 400,
    };
  }

  const matchedManagerId = managerIds[0]!;

  if (input.managerId && input.managerId !== matchedManagerId) {
    return {
      error: "Selected manager does not match the territory, area, region, and zone",
      status: 400,
    };
  }

  const manager = await prisma.manager.findUnique({
    where: { id: matchedManagerId },
    select: { id: true, isActive: true, name: true },
  });

  if (!manager || !manager.isActive) {
    return { error: "Matched manager is inactive or missing", status: 400 };
  }

  return { managerId: matchedManagerId };
}
