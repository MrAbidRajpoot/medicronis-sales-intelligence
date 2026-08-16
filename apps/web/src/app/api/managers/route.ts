import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyManagerAssignments, ensureVacantManagerId } from "@/lib/manager-helpers";
import { managerInclude, mapManager, parseIdList } from "@/lib/manager-dto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await ensureVacantManagerId();

  const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";

  const managers = await prisma.manager.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: "asc" },
    include: managerInclude,
  });

  return NextResponse.json(managers.map(mapManager));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body as { name?: string };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Manager name is required" }, { status: 400 });
    }

    const trimmed = name.trim();
    const existing = await prisma.manager.findUnique({ where: { name: trimmed } });
    if (existing) {
      return NextResponse.json({ error: "Manager name already exists" }, { status: 409 });
    }

    const created = await prisma.manager.create({ data: { name: trimmed } });

    await applyManagerAssignments(created.id, {
      territory: parseIdList(body.territoryIds),
      area: parseIdList(body.areaIds),
      region: parseIdList(body.regionIds),
      zone: parseIdList(body.zoneIds),
    });

    const manager = await prisma.manager.findUniqueOrThrow({
      where: { id: created.id },
      include: managerInclude,
    });

    return NextResponse.json(mapManager(manager), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
