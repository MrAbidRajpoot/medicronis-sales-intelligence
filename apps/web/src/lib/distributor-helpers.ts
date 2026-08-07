import { prisma } from "@/lib/prisma";

export async function resolveManagerId(
  managerId?: string | null,
  managerName?: string | null
): Promise<string | null | undefined> {
  if (managerName?.trim()) {
    const trimmed = managerName.trim();
    const existing = await prisma.manager.findUnique({ where: { name: trimmed } });
    if (existing) return existing.id;
    const created = await prisma.manager.create({ data: { name: trimmed } });
    return created.id;
  }

  if (managerId === null) return null;
  if (managerId) return managerId;
  return undefined;
}
