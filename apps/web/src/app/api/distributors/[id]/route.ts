import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  areaDelegate,
  assertActiveGeoId,
  distributorGeoInclude,
  regionDelegate,
  territoryDelegate,
  zoneDelegate,
} from "@/lib/geo-master";
import type { DistributorInputMode } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const distributor = await prisma.distributor.findUnique({
    where: { id: params.id },
    include: {
      ...distributorGeoInclude,
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
    const { code, name, territoryId, areaId, regionId, zoneId, isActive, inputMode } = body as {
      code?: string;
      name?: string;
      territoryId?: string | null;
      areaId?: string | null;
      regionId?: string | null;
      zoneId?: string | null;
      isActive?: boolean;
      inputMode?: DistributorInputMode;
    };

    if (code) {
      const existing = await prisma.distributor.findFirst({
        where: { code, NOT: { id: params.id } },
      });
      if (existing) {
        return NextResponse.json({ error: "Distributor code already exists" }, { status: 409 });
      }
    }

    if (inputMode !== undefined && inputMode !== "BOTH" && inputMode !== "EXCEL_ONLY") {
      return NextResponse.json({ error: "Invalid inputMode" }, { status: 400 });
    }

    let resolvedTerritoryId: string | null | undefined = undefined;
    let resolvedAreaId: string | null | undefined = undefined;
    let resolvedRegionId: string | null | undefined = undefined;
    let resolvedZoneId: string | null | undefined = undefined;
    try {
      if (territoryId !== undefined) {
        resolvedTerritoryId = await assertActiveGeoId(territoryDelegate, territoryId, "territory");
      }
      if (areaId !== undefined) {
        resolvedAreaId = await assertActiveGeoId(areaDelegate, areaId, "area");
      }
      if (regionId !== undefined) {
        resolvedRegionId = await assertActiveGeoId(regionDelegate, regionId, "region");
      }
      if (zoneId !== undefined) {
        resolvedZoneId = await assertActiveGeoId(zoneDelegate, zoneId, "zone");
      }
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid geo reference" },
        { status: 400 }
      );
    }

    const distributor = await prisma.distributor.update({
      where: { id: params.id },
      data: {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(resolvedTerritoryId !== undefined && { territoryId: resolvedTerritoryId }),
        ...(resolvedAreaId !== undefined && { areaId: resolvedAreaId }),
        ...(resolvedRegionId !== undefined && { regionId: resolvedRegionId }),
        ...(resolvedZoneId !== undefined && { zoneId: resolvedZoneId }),
        ...(isActive !== undefined && { isActive }),
        ...(inputMode !== undefined && { inputMode }),
      },
      include: {
        ...distributorGeoInclude,
      },
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
