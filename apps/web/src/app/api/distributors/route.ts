import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  areaDelegate,
  assertActiveGeoId,
  distributorGeoInclude,
  mapDistributorGeo,
  regionDelegate,
  territoryDelegate,
  zoneDelegate,
  type GeoRef,
} from "@/lib/geo-master";
import { resolveDistributorManagerName } from "@/lib/manager-helpers";
import {
  isDistributorExcelReady,
  isDistributorInputReady,
  isDistributorUploadReady,
} from "@/lib/template-readiness";
import type { DistributorInputMode } from "@prisma/client";

export const dynamic = "force-dynamic";

const templateSelect = {
  config: true,
  configuredAt: true,
  excelConfig: true,
  excelConfiguredAt: true,
} as const;

function mapDistributorRow(d: {
  id: string;
  code: string;
  name: string;
  territoryId: string | null;
  areaId: string | null;
  regionId: string | null;
  zoneId: string | null;
  territory?: GeoRef;
  area?: GeoRef;
  region?: GeoRef;
  zone?: GeoRef;
  pdfFormatId: string | null;
  inputMode: DistributorInputMode;
  templates: Array<{
    config: unknown;
    configuredAt: Date | null;
    excelConfig: unknown;
    excelConfiguredAt: Date | null;
  }>;
  _count?: { documents: number; productMappings: number };
  isActive?: boolean;
  createdAt?: Date;
}) {
  const activeTemplate = d.templates[0] ?? null;
  const templateReady = isDistributorUploadReady({
    pdfFormatId: d.pdfFormatId,
    activeTemplate,
  });
  const excelTemplateReady = isDistributorExcelReady({ activeTemplate });
  const uploadReady = isDistributorInputReady({
    pdfFormatId: d.pdfFormatId,
    activeTemplate,
    inputMode: d.inputMode,
  });

  return {
    id: d.id,
    code: d.code,
    name: d.name,
    ...mapDistributorGeo(d),
    managerName: resolveDistributorManagerName(d),
    inputMode: d.inputMode,
    templateReady,
    excelTemplateReady,
    uploadReady,
    ...(d.isActive !== undefined && { isActive: d.isActive }),
    ...(d._count && {
      documentCount: d._count.documents,
      mappingCount: d._count.productMappings,
    }),
    ...(d.createdAt && { createdAt: d.createdAt }),
  };
}

export async function GET(request: NextRequest) {
  const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";

  const include = {
    ...distributorGeoInclude,
    _count: { select: { documents: true, productMappings: true } },
    templates: {
      where: { isActive: true },
      orderBy: [{ version: "desc" as const }, { updatedAt: "desc" as const }],
      take: 1,
      select: templateSelect,
    },
  };

  if (includeInactive) {
    const distributors = await prisma.distributor.findMany({
      orderBy: { name: "asc" },
      include,
    });

    return NextResponse.json(distributors.map((d) => mapDistributorRow(d)));
  }

  const distributors = await prisma.distributor.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      territoryId: true,
      areaId: true,
      regionId: true,
      zoneId: true,
      pdfFormatId: true,
      inputMode: true,
      ...distributorGeoInclude,
      templates: {
        where: { isActive: true },
        orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
        take: 1,
        select: templateSelect,
      },
    },
  });

  return NextResponse.json(distributors.map((d) => mapDistributorRow(d)));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      code,
      name,
      territoryId,
      areaId,
      regionId,
      zoneId,
      pdfFormatId,
      inputMode,
    } = body as {
      code?: string;
      name?: string;
      territoryId?: string | null;
      areaId?: string | null;
      regionId?: string | null;
      zoneId?: string | null;
      pdfFormatId?: string;
      inputMode?: DistributorInputMode;
    };

    if (!code?.trim() || !name?.trim()) {
      return NextResponse.json({ error: "Code and name are required" }, { status: 400 });
    }

    if (inputMode && inputMode !== "BOTH" && inputMode !== "EXCEL_ONLY") {
      return NextResponse.json({ error: "Invalid inputMode" }, { status: 400 });
    }

    const pdfFormat = pdfFormatId?.trim()
      ? await prisma.pdfFormat.findFirst({
          where: { id: pdfFormatId, isActive: true },
        })
      : null;

    if (pdfFormatId?.trim() && !pdfFormat) {
      return NextResponse.json({ error: "Invalid or inactive PDF format" }, { status: 400 });
    }

    let resolvedTerritoryId: string | null = null;
    let resolvedAreaId: string | null = null;
    let resolvedRegionId: string | null = null;
    let resolvedZoneId: string | null = null;
    try {
      resolvedTerritoryId = await assertActiveGeoId(territoryDelegate, territoryId, "territory");
      resolvedAreaId = await assertActiveGeoId(areaDelegate, areaId, "area");
      resolvedRegionId = await assertActiveGeoId(regionDelegate, regionId, "region");
      resolvedZoneId = await assertActiveGeoId(zoneDelegate, zoneId, "zone");
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid geo reference" },
        { status: 400 }
      );
    }

    const existing = await prisma.distributor.findUnique({ where: { code: code.trim() } });
    if (existing) {
      return NextResponse.json({ error: "Distributor code already exists" }, { status: 409 });
    }

    const createData: Prisma.DistributorCreateInput = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      inputMode: inputMode ?? "BOTH",
      ...(resolvedTerritoryId && { territory: { connect: { id: resolvedTerritoryId } } }),
      ...(resolvedAreaId && { area: { connect: { id: resolvedAreaId } } }),
      ...(resolvedRegionId && { region: { connect: { id: resolvedRegionId } } }),
      ...(resolvedZoneId && { zone: { connect: { id: resolvedZoneId } } }),
      ...(pdfFormat && {
        pdfFormat: { connect: { id: pdfFormat.id } },
        templates: {
          create: {
            name: `${pdfFormat.name} — ${name.trim()}`,
            description: `Format family ${pdfFormat.family} default config`,
            version: 1,
            isActive: true,
            configuredAt: new Date(),
            config: pdfFormat.defaultConfig as Prisma.InputJsonValue,
          },
        },
      }),
    };

    const distributor = await prisma.distributor.create({
      data: createData,
      include: {
        pdfFormat: true,
        ...distributorGeoInclude,
      },
    });

    return NextResponse.json(distributor, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
