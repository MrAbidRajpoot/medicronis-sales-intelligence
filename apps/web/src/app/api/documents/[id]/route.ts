import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      distributor: true,
      extractionRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          extractedRows: {
            orderBy: { rowIndex: "asc" },
            include: { product: true },
          },
        },
      },
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const run = doc.extractionRuns[0];

  return NextResponse.json({
    id: doc.id,
    fileName: doc.fileName,
    status: doc.status,
    reportDate: doc.reportDate,
    distributor: doc.distributor,
    periodStart: doc.periodStart,
    periodEnd: doc.periodEnd,
    fileSize: doc.fileSize,
    createdAt: doc.createdAt,
    extractionRun: run
      ? {
          id: run.id,
          status: run.status,
          rowCount: run.rowCount,
          matchedCount: run.matchedCount,
          errorMessage: run.errorMessage,
          rows: run.extractedRows.map((r) => ({
            id: r.id,
            rowIndex: r.rowIndex,
            rawProductText: r.rawProductText,
            quantity: Number(r.quantity),
            unitPrice: r.unitPrice ? Number(r.unitPrice) : null,
            lineTotal: r.lineTotal ? Number(r.lineTotal) : null,
            status: r.status,
            product: r.product,
          })),
        }
      : null,
  });
}
