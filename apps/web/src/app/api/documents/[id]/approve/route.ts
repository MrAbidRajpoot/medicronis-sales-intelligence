import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLatestExtractionRun } from "@/lib/db-helpers";
import { replacePriorDocumentsForDistributorDate } from "@/lib/document-replace";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: params.id },
      include: { distributor: true },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!doc.distributorId || !doc.distributor) {
      return NextResponse.json({ error: "Document has no distributor assigned" }, { status: 400 });
    }

    const run = await getLatestExtractionRun(params.id);
    if (!run) {
      return NextResponse.json({ error: "No extraction run found" }, { status: 400 });
    }

    const unresolved = run.extractedRows.filter(
      (r) => r.status === "UNMATCHED" || r.status === "PENDING"
    );
    if (unresolved.length > 0) {
      return NextResponse.json(
        { error: `${unresolved.length} rows still need review before approval` },
        { status: 400 }
      );
    }

    const promotable = run.extractedRows.filter(
      (r) => (r.status === "MATCHED" || r.status === "REVIEWED") && r.productId
    );

    if (promotable.length === 0) {
      return NextResponse.json({ error: "No promotable rows found" }, { status: 400 });
    }

    const now = new Date();
    const saleDate = doc.reportDate;
    let totalValue = 0;

    // Drop any older same-distributor/date docs and their SSR facts before promoting.
    await replacePriorDocumentsForDistributorDate({
      distributorId: doc.distributorId,
      reportDate: saleDate,
      excludeDocumentId: doc.id,
    });

    await prisma.$transaction(async (tx) => {
      // Full replace for this distributor/date so removed products don't linger.
      await tx.dailySalesFact.deleteMany({
        where: {
          distributorId: doc.distributorId!,
          saleDate,
        },
      });

      for (const row of promotable) {
        const qty = Number(row.quantity);
        const unitPrice = row.unitPrice ? Number(row.unitPrice) : null;
        const salesValue = row.lineTotal
          ? Number(row.lineTotal)
          : qty * (unitPrice ?? 0);
        totalValue += salesValue;

        const closingStock = row.closingStock ? Number(row.closingStock) : null;
        const returnsQty = row.returnsQty ? Number(row.returnsQty) : null;

        await tx.dailySalesFact.upsert({
          where: {
            distributorId_productId_saleDate: {
              distributorId: doc.distributorId!,
              productId: row.productId!,
              saleDate,
            },
          },
          create: {
            distributorId: doc.distributorId!,
            productId: row.productId!,
            saleDate,
            quantity: qty,
            unitPrice,
            salesValue,
            closingStock,
            returnsQty,
            sourceDocumentId: doc.id,
            approvedAt: now,
          },
          update: {
            quantity: qty,
            unitPrice,
            salesValue,
            closingStock,
            returnsQty,
            sourceDocumentId: doc.id,
            approvedAt: now,
          },
        });
      }

      await tx.document.update({
        where: { id: doc.id },
        data: { status: "APPROVED" },
      });

      if (doc.templateId && run.rowCount > 0) {
        await tx.distributorTemplate.update({
          where: { id: doc.templateId },
          data: { lastSuccessfulRowCount: run.rowCount },
        });
      }
    });

    return NextResponse.json({
      documentId: doc.id,
      reportDate: saleDate,
      factCount: promotable.length,
      totalValue,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Approval failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
