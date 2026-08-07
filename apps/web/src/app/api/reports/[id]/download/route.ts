import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const format = request.nextUrl.searchParams.get("format") ?? "xlsx";

  const report = await prisma.ssrReport.findUnique({
    where: { id: params.id },
  });

  if (!report || report.salesBatchId) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (report.status !== "READY") {
    return NextResponse.json({ error: "Report file not ready" }, { status: 400 });
  }

  if (format === "pdf") {
    return NextResponse.json({ error: "PDF export not available for date-based reports" }, { status: 400 });
  }

  if (!report.filePath) {
    return NextResponse.json({ error: "Excel file not available" }, { status: 400 });
  }

  try {
    const buffer = await readFile(report.filePath);
    const fileName = path.basename(report.filePath);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Report file missing on disk" }, { status: 404 });
  }
}
