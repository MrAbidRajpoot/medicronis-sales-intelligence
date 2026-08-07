import { prisma } from "@/lib/prisma";
import { DocumentStatus } from "@prisma/client";

export async function getDemoUserId(): Promise<string> {
  const user = await prisma.user.findFirst({ where: { username: "demo" } });
  if (!user) throw new Error("Demo user not found — run prisma db seed");
  return user.id;
}

export async function getLatestExtractionRun(documentId: string) {
  return prisma.extractionRun.findFirst({
    where: { documentId },
    orderBy: { createdAt: "desc" },
    include: {
      extractedRows: { include: { product: true }, orderBy: { rowIndex: "asc" } },
    },
  });
}

export async function recalculateDocumentStatus(documentId: string): Promise<DocumentStatus> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc || doc.status === "APPROVED" || doc.status === "FAILED" || doc.status === "PROCESSING") {
    return doc?.status ?? "FAILED";
  }

  const run = await getLatestExtractionRun(documentId);
  if (!run) return doc.status;

  const rows = run.extractedRows;
  const unresolved = rows.filter((r) => r.status === "UNMATCHED" || r.status === "PENDING");
  const promotable = rows.filter(
    (r) => (r.status === "MATCHED" || r.status === "REVIEWED") && r.productId
  );

  let status: DocumentStatus;
  if (unresolved.length > 0) {
    status = "REVIEW_REQUIRED";
  } else if (promotable.length > 0) {
    status = "EXTRACTED";
  } else {
    status = "EXTRACTED";
  }

  await prisma.document.update({ where: { id: documentId }, data: { status } });
  return status;
}

export function batchCodeFor(distributorCode: string): string {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const suffix = distributorCode.replace("DIST-", "");
  return `SSR-${ym}-${suffix}-${Date.now().toString(36).toUpperCase()}`;
}

function normalizeDistributorKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Resolve distributor from PDF worker hints (code or name from report header). */
export async function findDistributorByExtractHints(hint: {
  distributor_hint?: string;
  distributor_name_hint?: string | null;
}) {
  const code = hint.distributor_hint;
  if (code && code !== "generic" && code !== "ssr-stock-return") {
    const byCode = await prisma.distributor.findUnique({ where: { code } });
    if (byCode) return byCode;
  }

  const nameHint = hint.distributor_name_hint?.trim();
  if (!nameHint) return null;

  const distributors = await prisma.distributor.findMany({ where: { isActive: true } });
  const normHint = normalizeDistributorKey(nameHint);

  for (const d of distributors) {
    const normName = normalizeDistributorKey(d.name);
    if (normName === normHint || normName.includes(normHint) || normHint.includes(normName)) {
      return d;
    }
    const hintParts = nameHint.split(/[,\s]+/).filter((p) => p.length > 1).map((p) => p.toUpperCase());
    const nameUpper = d.name.toUpperCase();
    if (hintParts.length >= 2 && hintParts.every((part) => nameUpper.includes(part))) {
      return d;
    }
  }

  return null;
}
