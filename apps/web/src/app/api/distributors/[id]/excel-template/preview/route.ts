import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  previewSalesExcel,
  readSalesExcelHeaders,
} from "@/lib/sales-excel-import";
import { validateExcelTemplateConfig } from "@/lib/excel-template-validation";
import type { ExcelTemplateConfig } from "@/lib/excel-template-types";

export const dynamic = "force-dynamic";

function parseOptionalConfig(value: FormDataEntryValue | null): ExcelTemplateConfig | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return JSON.parse(value) as ExcelTemplateConfig;
  } catch {
    return null;
  }
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
      return NextResponse.json({ error: "Sample Excel (.xlsx) file is required" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "File must be an .xlsx Excel workbook" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const overrideConfig = parseOptionalConfig(form.get("config"));
    const headerRowRaw = form.get("headerRow");
    const headerRow =
      typeof headerRowRaw === "string" && headerRowRaw.trim() !== ""
        ? Number(headerRowRaw)
        : overrideConfig?.headerRow ?? 0;

    if (!Number.isFinite(headerRow) || headerRow < 0) {
      return NextResponse.json({ error: "headerRow must be a non-negative number" }, { status: 400 });
    }

    const sheetNameRaw = form.get("sheetName");
    const sheetName =
      typeof sheetNameRaw === "string" && sheetNameRaw.trim()
        ? sheetNameRaw.trim()
        : overrideConfig?.sheetName;

    const headers = await readSalesExcelHeaders(buffer, { headerRow, sheetName });

    if (!overrideConfig) {
      return NextResponse.json({
        headerGrid: headers.headerGrid,
        previewRows: [],
        sheetName: headers.sheetName,
        headerRow: headers.headerRow,
        colCount: headers.colCount,
        unresolvedFields: ["product_name", "sales_qty"],
      });
    }

    const withMeta: ExcelTemplateConfig = {
      ...overrideConfig,
      source: "excel",
      headerRow,
      ...(sheetName ? { sheetName } : {}),
    };

    const validation = validateExcelTemplateConfig(withMeta);
    if (!validation.ok) {
      return NextResponse.json({
        headerGrid: headers.headerGrid,
        previewRows: [],
        sheetName: headers.sheetName,
        headerRow: headers.headerRow,
        colCount: headers.colCount,
        unresolvedFields: ["product_name", "sales_qty"],
        error: validation.error,
      });
    }

    const preview = await previewSalesExcel(buffer, validation.config, 8);

    return NextResponse.json({
      headerGrid: preview.headerGrid,
      previewRows: preview.previewRows,
      sheetName: preview.sheetName,
      headerRow: preview.headerRow,
      colCount: preview.colCount,
      unresolvedFields: [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Preview failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
