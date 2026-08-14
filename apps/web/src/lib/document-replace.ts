import { unlink } from "fs/promises";
import { prisma } from "@/lib/prisma";

export type ReplacedDocumentInfo = {
  id: string;
  fileName: string;
  filePath: string;
  status: string;
};

/**
 * Remove prior documents for the same distributor + report date so the latest
 * upload owns that slot. Also clears DailySalesFact rows for that day so SSR
 * no longer uses superseded data.
 */
export async function replacePriorDocumentsForDistributorDate(params: {
  distributorId: string;
  reportDate: Date;
  excludeDocumentId?: string;
}): Promise<ReplacedDocumentInfo[]> {
  const { distributorId, reportDate, excludeDocumentId } = params;

  const prior = await prisma.document.findMany({
    where: {
      distributorId,
      reportDate,
      ...(excludeDocumentId ? { id: { not: excludeDocumentId } } : {}),
    },
    select: { id: true, fileName: true, filePath: true, status: true },
  });

  if (prior.length === 0) return [];

  const priorIds = prior.map((d) => d.id);

  await prisma.$transaction(async (tx) => {
    await tx.dailySalesFact.deleteMany({
      where: { distributorId, saleDate: reportDate },
    });

    await tx.document.deleteMany({
      where: { id: { in: priorIds } },
    });
  });

  await Promise.all(
    prior.map(async (doc) => {
      try {
        await unlink(doc.filePath);
      } catch {
        // File may already be gone; DB row is the source of truth.
      }
    })
  );

  return prior;
}
