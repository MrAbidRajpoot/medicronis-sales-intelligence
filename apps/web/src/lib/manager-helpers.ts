import { prisma } from "@/lib/prisma";

export const VACANT_MANAGER_NAME = "Vacant";

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

/** Resolve a manager id, falling back to Vacant when missing/invalid. */
export async function resolveManagerIdOrVacant(
  managerId?: string | null
): Promise<string> {
  if (managerId?.trim()) {
    const row = await prisma.manager.findFirst({
      where: { id: managerId.trim(), isActive: true },
    });
    if (row) return row.id;
  }
  return ensureVacantManagerId();
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
