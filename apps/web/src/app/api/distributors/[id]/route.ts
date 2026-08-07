import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveManagerId } from "@/lib/distributor-helpers";
import { VALID_COUNTRIES, VALID_REGIONS } from "@/lib/distributor-options";
import type { DistributorCountry, DistributorRegion } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const distributor = await prisma.distributor.findUnique({
    where: { id: params.id },
    include: {
      manager: { select: { id: true, name: true } },
      _count: { select: { documents: true, productMappings: true } },
    },
  });

  if (!distributor) {
    return NextResponse.json({ error: "Distributor not found" }, { status: 404 });
  }

  return NextResponse.json(distributor);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { code, name, region, country, city, managerId, managerName, isActive } = body as {
      code?: string;
      name?: string;
      region?: DistributorRegion | null;
      country?: DistributorCountry | null;
      city?: string | null;
      managerId?: string | null;
      managerName?: string | null;
      isActive?: boolean;
    };

    if (code) {
      const existing = await prisma.distributor.findFirst({
        where: { code, NOT: { id: params.id } },
      });
      if (existing) {
        return NextResponse.json({ error: "Distributor code already exists" }, { status: 409 });
      }
    }

    if (region && !VALID_REGIONS.has(region)) {
      return NextResponse.json({ error: "Invalid region" }, { status: 400 });
    }

    if (country && !VALID_COUNTRIES.has(country)) {
      return NextResponse.json({ error: "Invalid country" }, { status: 400 });
    }

    const resolvedManagerId = await resolveManagerId(managerId, managerName);

    const distributor = await prisma.distributor.update({
      where: { id: params.id },
      data: {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(region !== undefined && { region }),
        ...(country !== undefined && { country }),
        ...(city !== undefined && { city: city?.trim() || null }),
        ...(resolvedManagerId !== undefined && { managerId: resolvedManagerId }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { manager: { select: { id: true, name: true } } },
    });

    return NextResponse.json(distributor);
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const distributor = await prisma.distributor.update({
      where: { id: params.id },
      data: { isActive: false },
    });
    return NextResponse.json(distributor);
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 404 });
  }
}
