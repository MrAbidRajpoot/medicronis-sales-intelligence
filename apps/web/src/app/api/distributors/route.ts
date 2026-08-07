import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveManagerId } from "@/lib/distributor-helpers";
import { VALID_COUNTRIES, VALID_REGIONS } from "@/lib/distributor-options";
import type { DistributorCountry, DistributorRegion } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";

  const include = {
    manager: { select: { id: true, name: true } },
    _count: { select: { documents: true, productMappings: true } },
  };

  if (includeInactive) {
    const distributors = await prisma.distributor.findMany({
      orderBy: { name: "asc" },
      include,
    });

    return NextResponse.json(
      distributors.map((d) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        region: d.region,
        country: d.country,
        city: d.city,
        managerId: d.managerId,
        managerName: d.manager?.name ?? null,
        isActive: d.isActive,
        documentCount: d._count.documents,
        mappingCount: d._count.productMappings,
        createdAt: d.createdAt,
      }))
    );
  }

  const distributors = await prisma.distributor.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      region: true,
      country: true,
      city: true,
      managerId: true,
      manager: { select: { name: true } },
    },
  });

  return NextResponse.json(
    distributors.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      region: d.region,
      country: d.country,
      city: d.city,
      managerId: d.managerId,
      managerName: d.manager?.name ?? null,
    }))
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, name, region, country, city, managerId, managerName } = body as {
      code?: string;
      name?: string;
      region?: DistributorRegion | null;
      country?: DistributorCountry | null;
      city?: string | null;
      managerId?: string | null;
      managerName?: string | null;
    };

    if (!code?.trim() || !name?.trim()) {
      return NextResponse.json({ error: "Code and name are required" }, { status: 400 });
    }

    if (region && !VALID_REGIONS.has(region)) {
      return NextResponse.json({ error: "Invalid region" }, { status: 400 });
    }

    if (country && !VALID_COUNTRIES.has(country)) {
      return NextResponse.json({ error: "Invalid country" }, { status: 400 });
    }

    const existing = await prisma.distributor.findUnique({ where: { code: code.trim() } });
    if (existing) {
      return NextResponse.json({ error: "Distributor code already exists" }, { status: 409 });
    }

    const resolvedManagerId = await resolveManagerId(managerId, managerName);

    const distributor = await prisma.distributor.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        region: region ?? null,
        country: country ?? null,
        city: city?.trim() || null,
        ...(resolvedManagerId !== undefined && { managerId: resolvedManagerId }),
      },
      include: { manager: { select: { id: true, name: true } } },
    });

    return NextResponse.json(distributor, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
