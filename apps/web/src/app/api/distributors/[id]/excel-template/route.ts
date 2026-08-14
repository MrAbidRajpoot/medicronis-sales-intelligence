import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getMissingExcelRecommendedFields,
  validateExcelTemplateConfig,
} from "@/lib/excel-template-validation";
import type { ExcelTemplateConfig } from "@/lib/excel-template-types";

export const dynamic = "force-dynamic";

type SaveBody = {
  config?: ExcelTemplateConfig;
  name?: string;
  description?: string;
};

async function parseSaveBody(request: NextRequest): Promise<
  | { ok: true; body: SaveBody }
  | { ok: false; error: string; status: number }
> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const configRaw = form.get("config");
    const name = form.get("name");
    const description = form.get("description");

    if (typeof configRaw !== "string" || !configRaw.trim()) {
      return { ok: false, error: "config is required", status: 400 };
    }

    let config: ExcelTemplateConfig;
    try {
      config = JSON.parse(configRaw) as ExcelTemplateConfig;
    } catch {
      return { ok: false, error: "config must be valid JSON", status: 400 };
    }

    return {
      ok: true,
      body: {
        config,
        name: typeof name === "string" ? name : undefined,
        description: typeof description === "string" ? description : undefined,
      },
    };
  }

  let json: SaveBody;
  try {
    json = (await request.json()) as SaveBody;
  } catch {
    return { ok: false, error: "Invalid JSON body", status: 400 };
  }

  return { ok: true, body: json };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const distributor = await prisma.distributor.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      code: true,
      name: true,
      inputMode: true,
      templates: {
        where: { isActive: true },
        orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
        take: 1,
        select: {
          id: true,
          name: true,
          version: true,
          excelConfig: true,
          excelConfiguredAt: true,
        },
      },
    },
  });

  if (!distributor) {
    return NextResponse.json({ error: "Distributor not found" }, { status: 404 });
  }

  const activeTemplate = distributor.templates[0] ?? null;

  return NextResponse.json({
    distributorId: distributor.id,
    code: distributor.code,
    name: distributor.name,
    inputMode: distributor.inputMode,
    activeTemplate: activeTemplate
      ? {
          id: activeTemplate.id,
          name: activeTemplate.name,
          version: activeTemplate.version,
          excelConfiguredAt: activeTemplate.excelConfiguredAt,
          excelConfig: activeTemplate.excelConfig,
        }
      : null,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const parsed = await parseSaveBody(request);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const { body } = parsed;
    if (!body.config) {
      return NextResponse.json({ error: "config is required" }, { status: 400 });
    }

    const validation = validateExcelTemplateConfig(body.config);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const distributor = await prisma.distributor.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, code: true },
    });

    if (!distributor) {
      return NextResponse.json({ error: "Distributor not found" }, { status: 404 });
    }

    const warnings = getMissingExcelRecommendedFields(validation.config);
    const active = await prisma.distributorTemplate.findFirst({
      where: { distributorId: distributor.id, isActive: true },
      orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
    });

    let template;
    if (active) {
      template = await prisma.distributorTemplate.update({
        where: { id: active.id },
        data: {
          excelConfig: validation.config as unknown as Prisma.InputJsonValue,
          excelConfiguredAt: new Date(),
          ...(body.name?.trim() ? { name: body.name.trim() } : {}),
          ...(body.description?.trim()
            ? { description: body.description.trim() }
            : {}),
        },
      });
    } else {
      template = await prisma.distributorTemplate.create({
        data: {
          distributorId: distributor.id,
          name: body.name?.trim() || `Excel map — ${distributor.name}`,
          description:
            body.description?.trim() || `Excel sales column map for ${distributor.name}`,
          version: 1,
          isActive: true,
          excelConfig: validation.config as unknown as Prisma.InputJsonValue,
          excelConfiguredAt: new Date(),
        },
      });
    }

    return NextResponse.json(
      {
        template: {
          id: template.id,
          distributorId: template.distributorId,
          name: template.name,
          version: template.version,
          excelConfig: template.excelConfig,
          excelConfiguredAt: template.excelConfiguredAt,
        },
        warnings:
          warnings.length > 0
            ? {
                missingRecommendedFields: warnings,
                message: `Recommended fields not mapped: ${warnings.join(", ")}`,
              }
            : undefined,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
