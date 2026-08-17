import { NextRequest, NextResponse } from "next/server";
import {
  buildProductWiseReport,
  parseMonthlyReportFilters,
  parseYearMonth,
} from "@/lib/monthly-reports/product-wise";
import { generateProductWiseExcel } from "@/lib/monthly-reports/export";
import { resolveMonthlyReportPeriod } from "@/lib/monthly-reports/query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const format = searchParams.get("format") ?? "xlsx";
    if (format !== "xlsx") {
      return NextResponse.json({ error: "Only format=xlsx is supported" }, { status: 400 });
    }

    const ym = parseYearMonth(searchParams);
    if ("error" in ym) {
      return NextResponse.json({ error: ym.error }, { status: 400 });
    }

    const filters = parseMonthlyReportFilters(searchParams);
    const report = await buildProductWiseReport(filters, ym.year, ym.month);
    const period = resolveMonthlyReportPeriod({ year: ym.year, month: ym.month });
    const { buffer, fileName } = await generateProductWiseExcel({
      period,
      rows: report.rows,
      totals: report.totals,
      coverage: report.coverage,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Download failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
