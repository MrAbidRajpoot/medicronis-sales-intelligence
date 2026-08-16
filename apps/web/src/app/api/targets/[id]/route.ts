import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  mapProductTarget,
  parseMonth,
  parseQuantity,
  parseYear,
  resolveMatchedManagerId,
  targetInclude,
} from "@/lib/target-helpers";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const target = await prisma.productTarget.findUnique({
    where: { id: params.id },
    include: targetInclude,
  });

  if (!target) {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }

  return NextResponse.json(mapProductTarget(target));
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const existing = await prisma.productTarget.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      productId,
      year: yearRaw,
      month: monthRaw,
      territoryId,
      areaId,
      regionId,
      zoneId,
      managerId,
      quantity: quantityRaw,
      isActive,
    } = body as {
      productId?: string;
      year?: unknown;
      month?: unknown;
      territoryId?: string;
      areaId?: string;
      regionId?: string;
      zoneId?: string;
      managerId?: string;
      quantity?: unknown;
      isActive?: boolean;
    };

    const nextProductId = productId ?? existing.productId;
    const nextTerritoryId = territoryId ?? existing.territoryId;
    const nextAreaId = areaId ?? existing.areaId;
    const nextRegionId = regionId ?? existing.regionId;
    const nextZoneId = zoneId ?? existing.zoneId;

    let year = existing.year;
    if (yearRaw !== undefined) {
      const parsed = parseYear(yearRaw);
      if (parsed === null) {
        return NextResponse.json({ error: "Year must be between 2000 and 2100" }, { status: 400 });
      }
      year = parsed;
    }

    let month = existing.month;
    if (monthRaw !== undefined) {
      const parsed = parseMonth(monthRaw);
      if (parsed === null) {
        return NextResponse.json({ error: "Month must be between 1 and 12" }, { status: 400 });
      }
      month = parsed;
    }

    let quantity: Prisma.Decimal | undefined;
    if (quantityRaw !== undefined) {
      const parsed = parseQuantity(quantityRaw);
      if (parsed === null) {
        return NextResponse.json({ error: "Quantity must be a non-negative number" }, { status: 400 });
      }
      quantity = parsed;
    }

    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: nextProductId },
        select: { id: true, isActive: true },
      });
      if (!product || !product.isActive) {
        return NextResponse.json({ error: "Product not found or inactive" }, { status: 400 });
      }
    }

    const matched = await resolveMatchedManagerId({
      territoryId: nextTerritoryId,
      areaId: nextAreaId,
      regionId: nextRegionId,
      zoneId: nextZoneId,
      managerId: managerId ?? existing.managerId,
    });
    if ("error" in matched) {
      return NextResponse.json({ error: matched.error }, { status: matched.status });
    }

    const duplicate = await prisma.productTarget.findFirst({
      where: {
        productId: nextProductId,
        year,
        month,
        territoryId: nextTerritoryId,
        areaId: nextAreaId,
        regionId: nextRegionId,
        zoneId: nextZoneId,
        NOT: { id: params.id },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "A target already exists for this product, period, and geography" },
        { status: 409 }
      );
    }

    const updated = await prisma.productTarget.update({
      where: { id: params.id },
      data: {
        productId: nextProductId,
        year,
        month,
        territoryId: nextTerritoryId,
        areaId: nextAreaId,
        regionId: nextRegionId,
        zoneId: nextZoneId,
        managerId: matched.managerId,
        ...(quantity !== undefined && { quantity }),
        ...(isActive !== undefined && { isActive }),
      },
      include: targetInclude,
    });

    return NextResponse.json(mapProductTarget(updated));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "A target already exists for this product, period, and geography" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const target = await prisma.productTarget.update({
      where: { id: params.id },
      data: { isActive: false },
      include: targetInclude,
    });
    return NextResponse.json(mapProductTarget(target));
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 404 });
  }
}
