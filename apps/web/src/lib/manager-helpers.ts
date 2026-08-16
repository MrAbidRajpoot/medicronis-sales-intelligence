import { prisma } from "@/lib/prisma";

export const VACANT_MANAGER_NAME = "Vacant";

export type GeoModel = "territory" | "area" | "region" | "zone";

export const GEO_MODELS: GeoModel[] = ["territory", "area", "region", "zone"];

/** Ensure the Vacant manager exists (and is active); return its id. */
export async function ensureVacantManagerId(): Promise<string> {
  const existing = await prisma.manager.findUnique({ where: { name: VACANT_MANAGER_NAME } });
  if (existing) {
    if (!existing.isActive) {
      await prisma.manager.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
    }
    return existing.id;
  }
  const created = await prisma.manager.create({ data: { name: VACANT_MANAGER_NAME } });
  return created.id;
}

export interface ManagerAssignments {
  territory?: string[];
  area?: string[];
  region?: string[];
  zone?: string[];
}

/**
 * Make `managerId` own exactly the listed rows per geo model. Rows it previously
 * owned that are no longer listed fall back to Vacant. Omitted models are untouched.
 */
export async function applyManagerAssignments(
  managerId: string,
  assignments: ManagerAssignments
): Promise<void> {
  const vacantId = await ensureVacantManagerId();
  if (managerId === vacantId) return;

  for (const model of GEO_MODELS) {
    const ids = assignments[model];
    if (ids === undefined) continue;

    // Prisma delegates share this shape but TypeScript can't union their signatures.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma[model] as any;

    await db.updateMany({
      where: { managerId, NOT: { id: { in: ids } } },
      data: { managerId: vacantId },
    });

    if (ids.length > 0) {
      await db.updateMany({
        where: { id: { in: ids } },
        data: { managerId },
      });
    }
  }
}

/** Prefer territory → area → region → zone manager for SSR / display. */
export function resolveDistributorManagerName(d: {
  territory?: { manager?: { name: string } | null } | null;
  area?: { manager?: { name: string } | null } | null;
  region?: { manager?: { name: string } | null } | null;
  zone?: { manager?: { name: string } | null } | null;
}): string | null {
  return (
    d.territory?.manager?.name ??
    d.area?.manager?.name ??
    d.region?.manager?.name ??
    d.zone?.manager?.name ??
    null
  );
}

/** Same priority chain as resolveDistributorManagerName, returning the manager id. */
export function resolveDistributorManagerId(d: {
  territory?: { managerId?: string | null; manager?: { id: string } | null } | null;
  area?: { managerId?: string | null; manager?: { id: string } | null } | null;
  region?: { managerId?: string | null; manager?: { id: string } | null } | null;
  zone?: { managerId?: string | null; manager?: { id: string } | null } | null;
}): string | null {
  return (
    d.territory?.manager?.id ??
    d.territory?.managerId ??
    d.area?.manager?.id ??
    d.area?.managerId ??
    d.region?.manager?.id ??
    d.region?.managerId ??
    d.zone?.manager?.id ??
    d.zone?.managerId ??
    null
  );
}
