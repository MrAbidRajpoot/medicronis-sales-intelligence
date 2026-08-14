import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeHeaders, extractPdf } from "@/lib/pdf-worker";
import {
  buildTemplateConfigFromPreset,
  getUnresolvedRequiredFields,
} from "@/lib/template-validation";
import type { CanonicalField, TemplateConfig } from "@/lib/pdf-template-types";
import { isCanonicalField } from "@/lib/pdf-template-types";
import { getDistributorLinePreset } from "@/lib/distributor-line-presets";
import {
  isLineFallbackStructure,
  mergeLineParser,
} from "@/lib/line-fallback-utils";

export const dynamic = "force-dynamic";

function parseOptionalConfig(value: FormDataEntryValue | null): TemplateConfig | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return JSON.parse(value) as TemplateConfig;
  } catch {
    return null;
  }
}

function normalizeUnresolved(fields: string[]): CanonicalField[] {
  return fields.filter(isCanonicalField);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const distributor = await prisma.distributor.findUnique({
      where: { id: params.id },
      select: { id: true, code: true, name: true },
    });

    if (!distributor) {
      return NextResponse.json({ error: "Distributor not found" }, { status: 404 });
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Sample PDF file is required" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const overrideConfig = parseOptionalConfig(form.get("config"));
    const pdfFormatIdRaw = form.get("pdfFormatId");
    const pdfFormatId = typeof pdfFormatIdRaw === "string" ? pdfFormatIdRaw : null;

    let presetConfig: TemplateConfig | null = null;
    let suggestedFormatCode = "";

    if (pdfFormatId) {
      const format = await prisma.pdfFormat.findFirst({
        where: { id: pdfFormatId, isActive: true },
      });
      if (!format) {
        return NextResponse.json({ error: "Invalid or inactive PDF format" }, { status: 400 });
      }
      presetConfig = format.defaultConfig as unknown as TemplateConfig;
      suggestedFormatCode = format.code;
    }

    const analysis = await analyzeHeaders(buffer, file.name, overrideConfig ?? presetConfig);

    if (!suggestedFormatCode) {
      suggestedFormatCode = analysis.suggestedFormatCode;
    }

    if (!presetConfig) {
      const format = await prisma.pdfFormat.findFirst({
        where: { code: suggestedFormatCode, isActive: true },
      });
      presetConfig = (format?.defaultConfig as unknown as TemplateConfig) ?? null;
    }

    const distributorPreset = getDistributorLinePreset(distributor.code);
    const lineFallback =
      isLineFallbackStructure(presetConfig?.headerStructure) ||
      isLineFallbackStructure(overrideConfig?.headerStructure) ||
      isLineFallbackStructure(analysis.headerStructure);

    let mergedPreset = presetConfig;
    if (lineFallback && (distributorPreset || presetConfig)) {
      mergedPreset = {
        ...(presetConfig ?? { headerStructure: "line_fallback", fields: {} }),
        ...(distributorPreset ?? {}),
        headerStructure: "line_fallback",
        tableExtractionDisabled: true,
        fields: {},
        lineParser: mergeLineParser(
          presetConfig?.lineParser,
          distributorPreset?.lineParser ?? overrideConfig?.lineParser
        ),
      };
    }

    const activeConfig: TemplateConfig =
      overrideConfig ??
      buildTemplateConfigFromPreset(
        analysis.headerStructure,
        mergedPreset ?? { headerStructure: analysis.headerStructure, fields: analysis.suggestedMappings },
        lineFallback ? {} : (analysis.suggestedMappings as TemplateConfig["fields"])
      );

    const extract = await extractPdf(buffer, file.name, {
      distributorCode: distributor.code,
      formatCode: suggestedFormatCode || analysis.suggestedFormatCode,
      templateConfig: activeConfig,
    });

    const labelUnresolved = lineFallback ? [] : normalizeUnresolved(analysis.unresolvedFields);
    const configUnresolved = getUnresolvedRequiredFields(activeConfig);
    const unresolvedFields = Array.from(
      new Set([...labelUnresolved, ...configUnresolved])
    );

    return NextResponse.json({
      suggestedFormatCode,
      confidence: analysis.confidence,
      headerStructure: analysis.headerStructure,
      headerGrid: analysis.headerGrid,
      detectedGroups: analysis.detectedGroups,
      leafColumns: analysis.leafColumns,
      suggestedMappings: activeConfig.fields,
      previewRows: extract.rows.slice(0, 5),
      unresolvedFields,
      colCount: analysis.colCount ?? null,
      extractConfidence: extract.confidence,
      extractMethod: extract.extract_method ?? "table",
      templateResolutionOk: extract.template_resolution_ok ?? true,
      usesLineParser: analysis.usesLineParser ?? lineFallback,
      lineParserPreview: analysis.lineParserPreview ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Preview failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
