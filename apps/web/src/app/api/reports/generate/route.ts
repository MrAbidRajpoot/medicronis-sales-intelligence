import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUserId, fetchSsrDataSheet } from "@/lib/db-helpers";
import { isFutureDate, parseIsoDate } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

/**
 * SSR semantics: one report per asOfDate = "Updated Sales Till {asOfDate}".
 * Prisma still has @@unique([asOfDate, viewType]); we always store viewType = DAY
 * and upsert only on asOfDate+DAY (minimal migration risk). Week/month are unused.
 *
 * Excel is not written to disk. Download rebuilds the workbook from DailySalesFact.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getDemoUserId();
    const body = await request.json();
    const { asOfDate, documentId } = body as {
      asOfDate?: string;
      documentId?: string;
    };

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
    } else {
      if (!asOfDate) {
        return NextResponse.json(
          { error: "asOfDate required (or pass documentId)" },
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
    }

    const { lines, reportCode } = await fetchSsrDataSheet(resolvedAsOfDate);
    const generatedAt = new Date();
    const totalValue = lines.reduce((s, l) => s + l.salesValue, 0);

    const report = await prisma.ssrReport.upsert({
      where: {
        asOfDate_viewType: {
          asOfDate: resolvedAsOfDate,
          viewType: "DAY",
        },
      },
      create: {
        viewType: "DAY",
        asOfDate: resolvedAsOfDate,
        filePath: null,
        status: "READY",
        generatedById: userId,
        generatedAt,
      },
      update: {
        filePath: null,
        status: "READY",
        generatedById: userId,
        generatedAt,
      },
    });

    return NextResponse.json({
      id: report.id,
      status: report.status,
      reportCode,
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
