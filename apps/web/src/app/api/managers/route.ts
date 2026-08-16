import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureVacantManagerId } from "@/lib/manager-helpers";

export const dynamic = "force-dynamic";

const managerCountSelect = {
  territories: true,
  areas: true,
  regions: true,
  zones: true,
} as const;

function mapManager(m: {
  id: string;
  name: string;
  isActive: boolean;
  _count: {
    territories: number;
    areas: number;
    regions: number;
    zones: number;
  };
}) {
  return {
    id: m.id,
    name: m.name,
    isActive: m.isActive,
    territoryCount: m._count.territories,
    areaCount: m._count.areas,
    regionCount: m._count.regions,
    zoneCount: m._count.zones,
    assignmentCount:
      m._count.territories + m._count.areas + m._count.regions + m._count.zones,
  };
}

export async function GET(request: NextRequest) {
  await ensureVacantManagerId();

  const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";

  const managers = await prisma.manager.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: "asc" },
    include: { _count: { select: managerCountSelect } },
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
    const existing = await prisma.manager.findUnique({
      where: { name: trimmed },
      include: { _count: { select: managerCountSelect } },
    });
    if (existing) {
      return NextResponse.json({ error: "Manager name already exists" }, { status: 409 });
    }

    const manager = await prisma.manager.create({
      data: { name: trimmed },
      include: { _count: { select: managerCountSelect } },
    });

    return NextResponse.json(mapManager(manager), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
