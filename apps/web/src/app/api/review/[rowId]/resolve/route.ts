import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalculateDocumentStatus } from "@/lib/db-helpers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { rowId: string } }) {
  try {
    const body = await request.json();
    const { productId, action } = body as {
      productId?: string;
      action: "approve" | "reject";
    };

    const row = await prisma.extractedRow.findUnique({
      where: { id: params.rowId },
      include: {
        extractionRun: { include: { document: true } },
      },
    });

    if (!row) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    if (action === "reject") {
      await prisma.extractedRow.update({
        where: { id: params.rowId },
        data: { status: "REJECTED", productId: null },
      });
      await recalculateDocumentStatus(row.extractionRun.documentId);
      return NextResponse.json({ ok: true, status: "REJECTED" });
    }

    if (!productId) {
      return NextResponse.json({ error: "productId required for approve" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const distributorId = row.distributorId ?? row.extractionRun.document.distributorId;

    await prisma.$transaction(async (tx) => {
      await tx.extractedRow.update({
        where: { id: params.rowId },
        data: { status: "REVIEWED", productId },
      });

      if (distributorId) {
        await tx.distributorProductMapping.upsert({
          where: {
            distributorId_rawProductText: {
              distributorId,
              rawProductText: row.rawProductText,
            },
          },
          update: { productId, confidence: 1, isVerified: true },
          create: {
            distributorId,
            rawProductText: row.rawProductText,
            productId,
            confidence: 1,
            isVerified: true,
          },
        });
      }

      const run = await tx.extractionRun.findUnique({
        where: { id: row.extractionRunId },
        include: { extractedRows: true },
      });
      if (run) {
        const matchedCount = run.extractedRows.filter(
          (r) =>
            r.id === params.rowId ||
            r.status === "MATCHED" ||
            (r.status === "REVIEWED" && r.productId)
        ).length;
        await tx.extractionRun.update({
          where: { id: run.id },
          data: { matchedCount },
        });
      }
    });

    const newStatus = await recalculateDocumentStatus(row.extractionRun.documentId);

    return NextResponse.json({
      ok: true,
      status: "REVIEWED",
      documentStatus: newStatus,
      product: { id: product.id, sku: product.sku, name: product.name },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Resolve failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
