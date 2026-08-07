/**
 * One-time migration: backfill DailySalesFact from legacy SalesLine / SalesBatch rows.
 *
 * Usage:
 *   npx tsx prisma/migrate-sales-lines-to-facts.ts
 *
 * For each SalesLine, creates a DailySalesFact when none exists for the same
 * distributor + product + saleDate. saleDate is document.periodEnd, falling back
 * to document.createdAt (UTC date). Uses batch.approvedAt when present.
 *
 * Does NOT delete SalesBatch or SalesLine — verify migrated counts before dropping
 * legacy tables.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function toUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function main() {
  const lines = await prisma.salesLine.findMany({
    include: {
      salesBatch: {
        include: { document: true },
      },
    },
  });

  let created = 0;
  let skipped = 0;

  for (const line of lines) {
    const batch = line.salesBatch;
    const doc = batch.document;
    const rawDate = doc?.periodEnd ?? doc?.createdAt ?? batch.periodEnd;
    const saleDate = toUtcDate(rawDate);

    const salesValue = line.lineTotal
      ? Number(line.lineTotal)
      : Number(line.quantity) * (line.unitPrice ? Number(line.unitPrice) : 0);

    const existing = await prisma.dailySalesFact.findUnique({
      where: {
        distributorId_productId_saleDate: {
          distributorId: batch.distributorId,
          productId: line.productId,
          saleDate,
        },
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.dailySalesFact.create({
      data: {
        distributorId: batch.distributorId,
        productId: line.productId,
        saleDate,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        salesValue,
        sourceDocumentId: batch.documentId,
        approvedAt: batch.approvedAt,
      },
    });
    created++;
  }

  console.log(`Migration complete: ${created} facts created, ${skipped} skipped (already exist).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
