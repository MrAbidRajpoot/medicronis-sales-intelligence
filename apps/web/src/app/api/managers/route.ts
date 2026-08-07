import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";

  const managers = await prisma.manager.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { distributors: true } } },
  });

  return NextResponse.json(
    managers.map((m) => ({
      id: m.id,
      name: m.name,
      isActive: m.isActive,
      distributorCount: m._count.distributors,
    }))
  );
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
      return NextResponse.json(existing);
    }

    const manager = await prisma.manager.create({
      data: { name: trimmed },
    });

    return NextResponse.json(manager, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
