import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";

  const manufacturers = await prisma.manufacturer.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return NextResponse.json(
    manufacturers.map((m) => ({
      id: m.id,
      name: m.name,
      isActive: m.isActive,
      productCount: m._count.products,
    }))
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body as { name?: string };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Manufacturer name is required" }, { status: 400 });
    }

    const trimmed = name.trim();
    const existing = await prisma.manufacturer.findUnique({ where: { name: trimmed } });
    if (existing) {
      return NextResponse.json(existing);
    }

    const manufacturer = await prisma.manufacturer.create({
      data: { name: trimmed },
    });

    return NextResponse.json(manufacturer, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
