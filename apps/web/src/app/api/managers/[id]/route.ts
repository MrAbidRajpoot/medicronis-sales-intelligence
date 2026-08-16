import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyManagerAssignments, VACANT_MANAGER_NAME } from "@/lib/manager-helpers";
import { managerInclude, mapManager, parseIdList } from "@/lib/manager-dto";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const manager = await prisma.manager.findUnique({
    where: { id: params.id },
    include: managerInclude,
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

    const isVacant = current.name === VACANT_MANAGER_NAME;
    if (isVacant) {
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

    await prisma.manager.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    if (!isVacant) {
      await applyManagerAssignments(params.id, {
        territory: parseIdList(body.territoryIds),
        area: parseIdList(body.areaIds),
        region: parseIdList(body.regionIds),
        zone: parseIdList(body.zoneIds),
      });
    }

    const manager = await prisma.manager.findUniqueOrThrow({
      where: { id: params.id },
      include: managerInclude,
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

    // Released geography falls back to Vacant so nothing is left unmanaged.
    await applyManagerAssignments(params.id, {
      territory: [],
      area: [],
      region: [],
      zone: [],
    });

    await prisma.manager.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    const manager = await prisma.manager.findUniqueOrThrow({
      where: { id: params.id },
      include: managerInclude,
    });

    return NextResponse.json(mapManager(manager));
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 404 });
  }
}
