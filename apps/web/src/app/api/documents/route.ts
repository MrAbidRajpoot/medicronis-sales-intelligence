import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const documents = await prisma.document.findMany({
    include: {
      distributor: true,
      extractionRuns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    documents.map((doc) => {
      const run = doc.extractionRuns[0];
      return {
        id: doc.id,
        fileName: doc.fileName,
        distributorId: doc.distributorId,
        distributorName: doc.distributor?.name ?? null,
        status: doc.status,
        reportDate: doc.reportDate,
        periodStart: doc.periodStart,
        periodEnd: doc.periodEnd,
        rowCount: run?.rowCount ?? 0,
        matchedCount: run?.matchedCount ?? 0,
        errorMessage: run?.errorMessage ?? null,
        uploadedAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    })
  );
}
