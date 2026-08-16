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

export async function GET(request: NextRequest) {
  const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";
  const yearParam = request.nextUrl.searchParams.get("year");
  const monthParam = request.nextUrl.searchParams.get("month");
  const productId = request.nextUrl.searchParams.get("productId");
  const managerId = request.nextUrl.searchParams.get("managerId");

  const year = yearParam ? parseYear(yearParam) : undefined;
  const month = monthParam ? parseMonth(monthParam) : undefined;

  if (yearParam && year === null) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (monthParam && month === null) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const targets = await prisma.productTarget.findMany({
    where: {
      ...(includeInactive ? {} : { isActive: true }),
      ...(year !== undefined && year !== null ? { year } : {}),
      ...(month !== undefined && month !== null ? { month } : {}),
      ...(productId ? { productId } : {}),
      ...(managerId ? { managerId } : {}),
    },
    orderBy: [{ year: "desc" }, { month: "desc" }, { product: { name: "asc" } }],
    include: targetInclude,
  });

  return NextResponse.json(targets.map(mapProductTarget));
}

export async function POST(request: NextRequest) {
  try {
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
    };

    if (!productId?.trim()) {
      return NextResponse.json({ error: "Product is required" }, { status: 400 });
    }
    if (!territoryId?.trim() || !areaId?.trim() || !regionId?.trim() || !zoneId?.trim()) {
      return NextResponse.json(
        { error: "Territory, area, region, and zone are required" },
        { status: 400 }
      );
    }

    const year = parseYear(yearRaw);
    const month = parseMonth(monthRaw);
    const quantity = parseQuantity(quantityRaw);

    if (year === null) {
      return NextResponse.json({ error: "Year must be between 2000 and 2100" }, { status: 400 });
    }
    if (month === null) {
      return NextResponse.json({ error: "Month must be between 1 and 12" }, { status: 400 });
    }
    if (quantity === null) {
      return NextResponse.json({ error: "Quantity must be a non-negative number" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true },
    });
    if (!product || !product.isActive) {
      return NextResponse.json({ error: "Product not found or inactive" }, { status: 400 });
    }

    const matched = await resolveMatchedManagerId({
      territoryId,
      areaId,
      regionId,
      zoneId,
      managerId,
    });
    if ("error" in matched) {
      return NextResponse.json({ error: matched.error }, { status: matched.status });
    }

    const existing = await prisma.productTarget.findUnique({
      where: {
        productId_year_month_territoryId_areaId_regionId_zoneId: {
          productId,
          year,
          month,
          territoryId,
          areaId,
          regionId,
          zoneId,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A target already exists for this product, period, and geography" },
        { status: 409 }
      );
    }

    const created = await prisma.productTarget.create({
      data: {
        productId,
        year,
        month,
        territoryId,
        areaId,
        regionId,
        zoneId,
        managerId: matched.managerId,
        quantity,
      },
      include: targetInclude,
    });

    return NextResponse.json(mapProductTarget(created), { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "A target already exists for this product, period, and geography" },
        { status: 409 }
      );
    }
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
