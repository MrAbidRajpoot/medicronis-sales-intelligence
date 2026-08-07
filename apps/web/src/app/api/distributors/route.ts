import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveManagerId } from "@/lib/distributor-helpers";
import { VALID_COUNTRIES, VALID_REGIONS } from "@/lib/distributor-options";
import { isDistributorUploadReady } from "@/lib/template-readiness";
import type { DistributorCountry, DistributorRegion } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";

  const include = {
    manager: { select: { id: true, name: true } },
    _count: { select: { documents: true, productMappings: true } },
    templates: {
      where: { isActive: true },
      orderBy: [{ version: "desc" as const }, { updatedAt: "desc" as const }],
      take: 1,
      select: { config: true, configuredAt: true },
    },
  };

  if (includeInactive) {
    const distributors = await prisma.distributor.findMany({
      orderBy: { name: "asc" },
      include,
    });

    return NextResponse.json(
      distributors.map((d) => {
        const activeTemplate = d.templates[0] ?? null;
        const templateReady = isDistributorUploadReady({
          pdfFormatId: d.pdfFormatId,
          activeTemplate,
        });
        return {
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
          templateReady,
          createdAt: d.createdAt,
        };
      })
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
      pdfFormatId: true,
      manager: { select: { name: true } },
      templates: {
        where: { isActive: true },
        orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
        take: 1,
        select: { config: true, configuredAt: true },
      },
    },
  });

  return NextResponse.json(
    distributors.map((d) => {
      const activeTemplate = d.templates[0] ?? null;
      const templateReady = isDistributorUploadReady({
        pdfFormatId: d.pdfFormatId,
        activeTemplate,
      });
      return {
        id: d.id,
        code: d.code,
        name: d.name,
        region: d.region,
        country: d.country,
        city: d.city,
        managerId: d.managerId,
        managerName: d.manager?.name ?? null,
        templateReady,
      };
    })
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, name, region, country, city, managerId, managerName, pdfFormatId } = body as {
      code?: string;
      name?: string;
      region?: DistributorRegion | null;
      country?: DistributorCountry | null;
      city?: string | null;
      managerId?: string | null;
      managerName?: string | null;
      pdfFormatId?: string;
    };

    if (!code?.trim() || !name?.trim()) {
      return NextResponse.json({ error: "Code and name are required" }, { status: 400 });
    }

    const pdfFormat = pdfFormatId?.trim()
      ? await prisma.pdfFormat.findFirst({
          where: { id: pdfFormatId, isActive: true },
        })
      : null;

    if (pdfFormatId?.trim() && !pdfFormat) {
      return NextResponse.json({ error: "Invalid or inactive PDF format" }, { status: 400 });
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

    const createData: Prisma.DistributorCreateInput = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      region: region ?? null,
      country: country ?? null,
      city: city?.trim() || null,
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

    if (resolvedManagerId !== undefined && resolvedManagerId !== null) {
      createData.manager = { connect: { id: resolvedManagerId } };
    }

    const distributor = await prisma.distributor.create({
      data: createData,
      include: { manager: { select: { id: true, name: true } }, pdfFormat: true },
    });

    return NextResponse.json(distributor, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
