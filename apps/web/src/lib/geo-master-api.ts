import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureVacantManagerId } from "@/lib/manager-helpers";

export const dynamic = "force-dynamic";

type GeoModel = "territory" | "area" | "region" | "zone";

/** Prisma model delegates share the same CRUD shape for these masters. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function delegate(model: GeoModel): any {
  return prisma[model];
}

const geoInclude = {
  manager: { select: { id: true, name: true } },
  _count: { select: { distributors: true } },
} as const;

function mapGeoRow(r: {
  id: string;
  name: string;
  isActive: boolean;
  managerId: string;
  manager?: { id: string; name: string } | null;
  _count: { distributors: number };
}) {
  return {
    id: r.id,
    name: r.name,
    isActive: r.isActive,
    managerId: r.managerId,
    managerName: r.manager?.name ?? null,
    distributorCount: r._count.distributors,
  };
}

export function createGeoCollectionHandlers(model: GeoModel, label: string) {
  const db = delegate(model);

  async function GET(request: NextRequest) {
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";

    const rows = await db.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: "asc" },
      include: geoInclude,
    });

    return NextResponse.json(rows.map(mapGeoRow));
  }

  async function POST(request: NextRequest) {
    try {
      const body = await request.json();
      const { name } = body as { name?: string };

      if (!name?.trim()) {
        return NextResponse.json({ error: `${label} name is required` }, { status: 400 });
      }

      const trimmed = name.trim();
      const existing = await db.findUnique({ where: { name: trimmed } });
      if (existing) {
        return NextResponse.json({ error: `${label} name already exists` }, { status: 409 });
      }

      // Managers are assigned from the Managers page; new rows start out Vacant.
      const vacantId = await ensureVacantManagerId();

      const row = await db.create({
        data: { name: trimmed, managerId: vacantId },
        include: geoInclude,
      });

      return NextResponse.json(mapGeoRow(row), { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Create failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return { GET, POST };
}

export function createGeoItemHandlers(model: GeoModel, label: string) {
  const db = delegate(model);

  async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    const row = await db.findUnique({
      where: { id: params.id },
      include: geoInclude,
    });

    if (!row) {
      return NextResponse.json({ error: `${label} not found` }, { status: 404 });
    }

    return NextResponse.json(mapGeoRow(row));
  }

  async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
    try {
      const body = await request.json();
      const { name, isActive } = body as { name?: string; isActive?: boolean };

      if (name !== undefined) {
        const trimmed = name.trim();
        if (!trimmed) {
          return NextResponse.json({ error: `${label} name is required` }, { status: 400 });
        }

        const existing = await db.findFirst({
          where: { name: trimmed, NOT: { id: params.id } },
        });
        if (existing) {
          return NextResponse.json({ error: `${label} name already exists` }, { status: 409 });
        }
      }

      const row = await db.update({
        where: { id: params.id },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(isActive !== undefined && { isActive }),
        },
        include: geoInclude,
      });

      return NextResponse.json(mapGeoRow(row));
    } catch {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
  }

  async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    try {
      const row = await db.update({
        where: { id: params.id },
        data: { isActive: false },
        include: geoInclude,
      });

      return NextResponse.json(mapGeoRow(row));
    } catch {
      return NextResponse.json({ error: "Delete failed" }, { status: 404 });
    }
  }

  return { GET, PATCH, DELETE };
}
