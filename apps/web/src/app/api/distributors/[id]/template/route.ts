import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getMissingRecommendedFields,
  validateTemplateConfig,
} from "@/lib/template-validation";
import type { TemplateConfig } from "@/lib/pdf-template-types";

export const dynamic = "force-dynamic";

type SaveTemplateBody = {
  pdfFormatId?: string;
  config?: TemplateConfig;
  name?: string;
  description?: string;
};

async function parseSaveBody(request: NextRequest): Promise<
  | { ok: true; body: SaveTemplateBody; sampleBuffer: Buffer | null; sampleName: string | null }
  | { ok: false; error: string; status: number }
> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const pdfFormatId = form.get("pdfFormatId");
    const configRaw = form.get("config");
    const name = form.get("name");
    const description = form.get("description");
    const sample = form.get("sampleFile");

    if (typeof pdfFormatId !== "string" || !pdfFormatId.trim()) {
      return { ok: false, error: "pdfFormatId is required", status: 400 };
    }

    if (typeof configRaw !== "string" || !configRaw.trim()) {
      return { ok: false, error: "config is required", status: 400 };
    }

    let config: TemplateConfig;
    try {
      config = JSON.parse(configRaw) as TemplateConfig;
    } catch {
      return { ok: false, error: "config must be valid JSON", status: 400 };
    }

    let sampleBuffer: Buffer | null = null;
    let sampleName: string | null = null;
    if (sample instanceof File && sample.size > 0) {
      if (!sample.name.toLowerCase().endsWith(".pdf")) {
        return { ok: false, error: "sampleFile must be a PDF", status: 400 };
      }
      sampleBuffer = Buffer.from(await sample.arrayBuffer());
      sampleName = sample.name;
    }

    return {
      ok: true,
      body: {
        pdfFormatId: pdfFormatId.trim(),
        config,
        name: typeof name === "string" ? name : undefined,
        description: typeof description === "string" ? description : undefined,
      },
      sampleBuffer,
      sampleName,
    };
  }

  let json: SaveTemplateBody;
  try {
    json = (await request.json()) as SaveTemplateBody;
  } catch {
    return { ok: false, error: "Invalid JSON body", status: 400 };
  }

  if (!json.pdfFormatId?.trim()) {
    return { ok: false, error: "pdfFormatId is required", status: 400 };
  }

  return {
    ok: true,
    body: json,
    sampleBuffer: null,
    sampleName: null,
  };
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

    const distributor = await prisma.distributor.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, code: true },
    });

    if (!distributor) {
      return NextResponse.json({ error: "Distributor not found" }, { status: 404 });
    }

    const pdfFormat = await prisma.pdfFormat.findFirst({
      where: { id: body.pdfFormatId, isActive: true },
    });

    if (!pdfFormat) {
      return NextResponse.json({ error: "Invalid or inactive PDF format" }, { status: 400 });
    }

    if (!body.config) {
      return NextResponse.json({ error: "config is required" }, { status: 400 });
    }

    const validation = validateTemplateConfig(body.config);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const warnings = getMissingRecommendedFields(validation.config);
    const latest = await prisma.distributorTemplate.findFirst({
      where: { distributorId: distributor.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const templateName =
      body.name?.trim() ||
      `${pdfFormat.name} — ${distributor.name} v${nextVersion}`;

    const [, template] = await prisma.$transaction([
      prisma.distributorTemplate.updateMany({
        where: { distributorId: distributor.id, isActive: true },
        data: { isActive: false },
      }),
      prisma.distributorTemplate.create({
        data: {
          distributorId: distributor.id,
          name: templateName,
          description:
            body.description?.trim() ||
            `Template mapping for ${pdfFormat.family} (${pdfFormat.code})`,
          version: nextVersion,
          isActive: true,
          configuredAt: new Date(),
          config: validation.config as unknown as Prisma.InputJsonValue,
        },
      }),
      prisma.distributor.update({
        where: { id: distributor.id },
        data: { pdfFormatId: pdfFormat.id },
      }),
    ]);

    return NextResponse.json(
      {
        template: {
          id: template.id,
          distributorId: template.distributorId,
          name: template.name,
          description: template.description,
          version: template.version,
          isActive: template.isActive,
          config: template.config,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
        },
        pdfFormat: {
          id: pdfFormat.id,
          code: pdfFormat.code,
          name: pdfFormat.name,
          family: pdfFormat.family,
        },
        warnings:
          warnings.length > 0
            ? {
                missingRecommendedFields: warnings,
                message: `Optional fields not mapped: ${warnings.join(", ")}`,
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

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const distributor = await prisma.distributor.findUnique({
    where: { id: params.id },
    include: {
      pdfFormat: true,
      templates: {
        where: { isActive: true },
        orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
        take: 1,
      },
    },
  });

  if (!distributor) {
    return NextResponse.json({ error: "Distributor not found" }, { status: 404 });
  }

  const activeTemplate = distributor.templates[0] ?? null;

  return NextResponse.json({
    distributorId: distributor.id,
    pdfFormat: distributor.pdfFormat
      ? {
          id: distributor.pdfFormat.id,
          code: distributor.pdfFormat.code,
          name: distributor.pdfFormat.name,
          family: distributor.pdfFormat.family,
          headerStructure: distributor.pdfFormat.headerStructure,
          defaultConfig: distributor.pdfFormat.defaultConfig,
        }
      : null,
    activeTemplate: activeTemplate
      ? {
          id: activeTemplate.id,
          name: activeTemplate.name,
          version: activeTemplate.version,
          configuredAt: activeTemplate.configuredAt,
          config: activeTemplate.config,
        }
      : null,
  });
}
