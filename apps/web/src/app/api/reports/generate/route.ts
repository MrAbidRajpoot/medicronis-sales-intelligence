import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUserId, fetchSsrGridMasters } from "@/lib/db-helpers";
import { isFutureDate, parseIsoDate } from "@/lib/date-utils";
import { generateSsrDataExcel } from "@/lib/ssr-export";
import {
  buildDataSheetRows,
  buildDateRange,
  getSsrExportFactBounds,
  reportCodeFor,
  type SsrViewTypeLabel,
} from "@/lib/ssr-data";
import { SsrViewType } from "@prisma/client";

export const dynamic = "force-dynamic";

const VIEW_TYPE_MAP: Record<SsrViewTypeLabel, SsrViewType> = {
  day: "DAY",
  week: "WEEK",
  month: "MONTH",
};

function parseViewType(value: string): SsrViewTypeLabel | null {
  if (value === "day" || value === "week" || value === "month") return value;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getDemoUserId();
    const body = await request.json();
    const { viewType, asOfDate, documentId } = body as {
      viewType?: string;
      asOfDate?: string;
      documentId?: string;
    };

    let resolvedViewType: SsrViewType = "DAY";
    let resolvedViewLabel: SsrViewTypeLabel = "day";
    let resolvedAsOfDate: Date | null = null;

    if (documentId) {
      const doc = await prisma.document.findUnique({ where: { id: documentId } });
      if (!doc) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      if (doc.status !== "APPROVED") {
        return NextResponse.json({ error: "Document must be approved first" }, { status: 400 });
      }
      resolvedAsOfDate = doc.reportDate;
      resolvedViewType = "DAY";
      resolvedViewLabel = "day";
    } else {
      if (!viewType || !asOfDate) {
        return NextResponse.json(
          { error: "viewType and asOfDate required (or pass documentId)" },
          { status: 400 }
        );
      }

      const parsedViewType = parseViewType(viewType);
      if (!parsedViewType) {
        return NextResponse.json(
          { error: "viewType must be day, week, or month" },
          { status: 400 }
        );
      }

      resolvedAsOfDate = parseIsoDate(asOfDate);
      if (!resolvedAsOfDate) {
        return NextResponse.json({ error: "Invalid asOfDate — use YYYY-MM-DD" }, { status: 400 });
      }
      if (isFutureDate(resolvedAsOfDate)) {
        return NextResponse.json({ error: "asOfDate cannot be in the future" }, { status: 400 });
      }

      resolvedViewType = VIEW_TYPE_MAP[parsedViewType];
      resolvedViewLabel = parsedViewType;
    }

    const range = buildDateRange(resolvedViewLabel, resolvedAsOfDate);
    const factBounds = getSsrExportFactBounds(resolvedViewLabel, resolvedAsOfDate);

    const facts = await prisma.dailySalesFact.findMany({
      where: {
        saleDate: {
          gte: factBounds.min,
          lte: factBounds.max,
        },
      },
      include: {
        distributor: { include: { manager: true } },
        product: true,
      },
      orderBy: [{ distributor: { name: "asc" } }, { product: { name: "asc" } }],
    });

    const masters = await fetchSsrGridMasters();
    const generatedAt = new Date();
    const reportCode = `${reportCodeFor(resolvedAsOfDate, resolvedViewLabel)}-${Date.now().toString(36).toUpperCase()}`;
    const lines = buildDataSheetRows(facts, range, {
      asOfDate: resolvedAsOfDate,
      viewType: resolvedViewLabel,
      masters,
    });

    const { filePath } = await generateSsrDataExcel(
      {
        reportCode,
        asOfDate: resolvedAsOfDate,
        viewType: resolvedViewLabel,
        periodStart: range.start,
        periodEnd: range.end,
        generatedAt,
      },
      lines
    );

    const totalValue = lines.reduce((s, l) => s + l.salesValue, 0);

    const report = await prisma.ssrReport.create({
      data: {
        viewType: resolvedViewType,
        asOfDate: resolvedAsOfDate,
        filePath,
        status: "READY",
        generatedById: userId,
        generatedAt,
      },
    });

    return NextResponse.json({
      id: report.id,
      status: report.status,
      reportCode,
      viewType: resolvedViewLabel,
      asOfDate: asOfDate ?? resolvedAsOfDate,
      lineCount: lines.length,
      totalValue,
      filePath: report.filePath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "SSR generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
