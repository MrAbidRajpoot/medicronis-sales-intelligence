import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSsrDataSheet } from "@/lib/db-helpers";
import { generateSsrDataExcel } from "@/lib/ssr-export";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const format = request.nextUrl.searchParams.get("format") ?? "xlsx";

  const report = await prisma.ssrReport.findUnique({
    where: { id: params.id },
  });

  if (!report || report.salesBatchId || !report.asOfDate) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (report.status !== "READY") {
    return NextResponse.json({ error: "Report file not ready" }, { status: 400 });
  }

  if (format === "pdf") {
    return NextResponse.json({ error: "PDF export not available for date-based reports" }, { status: 400 });
  }

  try {
    const { lines, range, reportCode } = await fetchSsrDataSheet(report.asOfDate);
    const { buffer, fileName } = await generateSsrDataExcel(
      {
        reportCode,
        asOfDate: report.asOfDate,
        periodStart: range.start,
        periodEnd: range.end,
        generatedAt: new Date(),
      },
      lines
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Download failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
