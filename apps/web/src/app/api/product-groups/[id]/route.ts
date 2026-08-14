import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const group = await prisma.productGroup.findUnique({
    where: { id: params.id },
    include: { _count: { select: { products: true } } },
  });

  if (!group) {
    return NextResponse.json({ error: "Product group not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: group.id,
    name: group.name,
    isActive: group.isActive,
    productCount: group._count.products,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { name, isActive } = body as { name?: string; isActive?: boolean };

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Product group name is required" }, { status: 400 });
      }

      const existing = await prisma.productGroup.findFirst({
        where: { name: trimmed, NOT: { id: params.id } },
      });
      if (existing) {
        return NextResponse.json({ error: "Product group name already exists" }, { status: 409 });
      }
    }

    const group = await prisma.productGroup.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { _count: { select: { products: true } } },
    });

    return NextResponse.json({
      id: group.id,
      name: group.name,
      isActive: group.isActive,
      productCount: group._count.products,
    });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const group = await prisma.productGroup.update({
      where: { id: params.id },
      data: { isActive: false },
      include: { _count: { select: { products: true } } },
    });

    return NextResponse.json({
      id: group.id,
      name: group.name,
      isActive: group.isActive,
      productCount: group._count.products,
    });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 404 });
  }
}
