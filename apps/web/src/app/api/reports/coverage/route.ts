import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isFutureDate, parseIsoDate } from "@/lib/date-utils";
import { buildDateRange } from "@/lib/ssr-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const asOfDateParam = request.nextUrl.searchParams.get("asOfDate");

  if (!asOfDateParam) {
    return NextResponse.json({ error: "asOfDate required (YYYY-MM-DD)" }, { status: 400 });
  }

  const asOfDate = parseIsoDate(asOfDateParam);
  if (!asOfDate) {
    return NextResponse.json({ error: "Invalid asOfDate — use YYYY-MM-DD" }, { status: 400 });
  }
  if (isFutureDate(asOfDate)) {
    return NextResponse.json({ error: "asOfDate cannot be in the future" }, { status: 400 });
  }

  const range = buildDateRange(asOfDate);

  const [distributorGroups, activeDistributors] = await Promise.all([
    prisma.dailySalesFact.groupBy({
      by: ["distributorId"],
      where: {
        saleDate: {
          gte: range.start,
          lte: range.end,
        },
      },
    }),
    prisma.distributor.count({ where: { isActive: true } }),
  ]);

  return NextResponse.json({
    asOfDate: asOfDateParam,
    distributorsWithData: distributorGroups.length,
    activeDistributors,
  });
}
