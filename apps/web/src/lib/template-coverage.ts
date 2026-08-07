import type { PrismaClient } from "@prisma/client";
import { isDistributorUploadReady } from "@/lib/template-readiness";

export type TemplateCoverageStatus = "ok" | "missing" | "mismatch";

export type TemplateCoverageRow = {
  distributorId: string;
  distributorCode: string;
  distributorName: string;
  formatFamily: string;
  formatName: string;
  lastUploadRowCount: number | null;
  expectedRowCount: number | null;
  status: TemplateCoverageStatus;
  mismatchDocumentId: string | null;
};

export type TemplateCoverageReport = {
  kpis: {
    ok: number;
    missing: number;
    mismatch: number;
    total: number;
  };
  rows: TemplateCoverageRow[];
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function getTemplateCoverageReport(
  db: PrismaClient
): Promise<TemplateCoverageReport> {
  const since = new Date(Date.now() - THIRTY_DAYS_MS);

  const distributors = await db.distributor.findMany({
    where: { isActive: true },
    include: {
      pdfFormat: true,
      templates: {
        where: { isActive: true },
        orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  const recentMismatchDocs = await db.document.findMany({
    where: {
      status: "TEMPLATE_MISMATCH",
      createdAt: { gte: since },
      distributorId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, distributorId: true },
  });

  const mismatchByDistributor = new Map<string, string>();
  for (const doc of recentMismatchDocs) {
    if (doc.distributorId && !mismatchByDistributor.has(doc.distributorId)) {
      mismatchByDistributor.set(doc.distributorId, doc.id);
    }
  }

  const recentDocuments = await db.document.findMany({
    where: {
      distributorId: { not: null },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    include: {
      extractionRuns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const lastUploadByDistributor = new Map<string, number>();
  for (const doc of recentDocuments) {
    if (!doc.distributorId || lastUploadByDistributor.has(doc.distributorId)) continue;
    const run = doc.extractionRuns[0];
    if (run) {
      lastUploadByDistributor.set(doc.distributorId, run.rowCount);
    }
  }

  const rows: TemplateCoverageRow[] = distributors.map((d) => {
    const activeTemplate = d.templates[0] ?? null;
    const uploadReady = isDistributorUploadReady({
      pdfFormatId: d.pdfFormatId,
      activeTemplate,
    });
    const mismatchDocumentId = mismatchByDistributor.get(d.id) ?? null;

    let status: TemplateCoverageStatus;
    if (mismatchDocumentId) {
      status = "mismatch";
    } else if (!uploadReady) {
      status = "missing";
    } else {
      status = "ok";
    }

    return {
      distributorId: d.id,
      distributorCode: d.code,
      distributorName: d.name,
      formatFamily: d.pdfFormat?.family ?? "—",
      formatName: d.pdfFormat?.name ?? "—",
      lastUploadRowCount: lastUploadByDistributor.get(d.id) ?? null,
      expectedRowCount: activeTemplate?.lastSuccessfulRowCount ?? null,
      status,
      mismatchDocumentId,
    };
  });

  const kpis = {
    ok: rows.filter((r) => r.status === "ok").length,
    missing: rows.filter((r) => r.status === "missing").length,
    mismatch: rows.filter((r) => r.status === "mismatch").length,
    total: rows.length,
  };

  return { kpis, rows };
}

export function templateCoverageStatusLabel(status: TemplateCoverageStatus): string {
  const labels: Record<TemplateCoverageStatus, string> = {
    ok: "Template OK",
    missing: "Template Missing",
    mismatch: "Template Mismatch",
  };
  return labels[status];
}
