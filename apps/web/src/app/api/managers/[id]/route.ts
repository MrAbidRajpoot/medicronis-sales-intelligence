import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VACANT_MANAGER_NAME } from "@/lib/manager-helpers";

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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const manager = await prisma.manager.findUnique({
    where: { id: params.id },
    include: { _count: { select: managerCountSelect } },
  });

  if (!manager) {
    return NextResponse.json({ error: "Manager not found" }, { status: 404 });
  }

  return NextResponse.json(mapManager(manager));
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { name, isActive } = body as { name?: string; isActive?: boolean };

    const current = await prisma.manager.findUnique({ where: { id: params.id } });
    if (!current) {
      return NextResponse.json({ error: "Manager not found" }, { status: 404 });
    }

    if (current.name === VACANT_MANAGER_NAME) {
      if (name !== undefined && name.trim() !== VACANT_MANAGER_NAME) {
        return NextResponse.json({ error: "Vacant manager cannot be renamed" }, { status: 400 });
      }
      if (isActive === false) {
        return NextResponse.json({ error: "Vacant manager cannot be deactivated" }, { status: 400 });
      }
    }

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Manager name is required" }, { status: 400 });
      }

      const existing = await prisma.manager.findFirst({
        where: { name: trimmed, NOT: { id: params.id } },
      });
      if (existing) {
        return NextResponse.json({ error: "Manager name already exists" }, { status: 409 });
      }
    }

    const manager = await prisma.manager.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { _count: { select: managerCountSelect } },
    });

    return NextResponse.json(mapManager(manager));
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const current = await prisma.manager.findUnique({ where: { id: params.id } });
    if (!current) {
      return NextResponse.json({ error: "Manager not found" }, { status: 404 });
    }
    if (current.name === VACANT_MANAGER_NAME) {
      return NextResponse.json({ error: "Vacant manager cannot be deactivated" }, { status: 400 });
    }

    const manager = await prisma.manager.update({
      where: { id: params.id },
      data: { isActive: false },
      include: { _count: { select: managerCountSelect } },
    });

    return NextResponse.json(mapManager(manager));
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 404 });
  }
}
