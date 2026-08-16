import { NextRequest, NextResponse } from "next/server";
import {
  buildProductWiseReport,
  parseMonthlyReportFilters,
  parseYearMonth,
  resolveProductWiseDefaultMonth,
} from "@/lib/monthly-reports/product-wise";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    if (searchParams.get("meta") === "1") {
      const defaultMonth = await resolveProductWiseDefaultMonth();
      return NextResponse.json({ defaultMonth });
    }

    const ym = parseYearMonth(searchParams);
    if ("error" in ym) {
      return NextResponse.json({ error: ym.error }, { status: 400 });
    }

    const filters = parseMonthlyReportFilters(searchParams);
    const report = await buildProductWiseReport(filters, ym.year, ym.month);
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
