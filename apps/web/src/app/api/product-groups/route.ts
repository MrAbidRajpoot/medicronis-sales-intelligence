import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";

  const groups = await prisma.productGroup.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return NextResponse.json(
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      isActive: g.isActive,
      productCount: g._count.products,
    }))
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body as { name?: string };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Product group name is required" }, { status: 400 });
    }

    const trimmed = name.trim();
    const existing = await prisma.productGroup.findUnique({ where: { name: trimmed } });
    if (existing) {
      return NextResponse.json({ error: "Product group name already exists" }, { status: 409 });
    }

    const group = await prisma.productGroup.create({
      data: { name: trimmed },
      include: { _count: { select: { products: true } } },
    });

    return NextResponse.json(
      {
        id: group.id,
        name: group.name,
        isActive: group.isActive,
        productCount: group._count.products,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
