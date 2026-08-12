import { prisma } from "@/lib/prisma";
import { DocumentStatus } from "@prisma/client";
import type { SsrGridMasters } from "@/lib/ssr-data";

export async function fetchSsrGridMasters(): Promise<SsrGridMasters> {
  const [distributors, products] = await Promise.all([
    prisma.distributor.findMany({
      where: { isActive: true },
      include: { manager: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      include: { productGroup: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { distributors, products };
}

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
  if (!doc || doc.status === "APPROVED" || doc.status === "FAILED" || doc.status === "PROCESSING" || doc.status === "TEMPLATE_MISMATCH") {
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

export {
  ROW_COUNT_MISMATCH_THRESHOLD,
  TEMPLATE_MISMATCH_MESSAGE,
  isRowCountMismatch,
  detectTemplateMismatch,
} from "@/lib/template-mismatch";

export type DistributorUploadContext = {
  distributor: {
    id: string;
    code: string;
    name: string;
    pdfFormatId: string;
    pdfFormat: { id: string; code: string; name: string; family: string };
  };
  template: { id: string; lastSuccessfulRowCount: number | null };
  templateConfig: import("@/lib/pdf-template-types").TemplateConfig;
};

export async function loadDistributorUploadContext(
  distributorId: string
): Promise<{ ok: true; context: DistributorUploadContext } | { ok: false; error: string }> {
  const distributor = await prisma.distributor.findUnique({
    where: { id: distributorId },
    include: { pdfFormat: true },
  });

  if (!distributor) {
    return { ok: false, error: "Distributor not found" };
  }

  if (!distributor.pdfFormatId || !distributor.pdfFormat) {
    return {
      ok: false,
      error: `Distributor "${distributor.name}" has no PDF format assigned. Assign a format before uploading.`,
    };
  }

  const tmpl = await getActiveDistributorTemplate(distributorId);
  if (!tmpl) {
    return {
      ok: false,
      error: `No active PDF template for "${distributor.name}". Create and activate a column mapping template first.`,
    };
  }

  if (!tmpl.configuredAt) {
    return {
      ok: false,
      error: `PDF template for "${distributor.name}" is not configured. Complete the template mapping wizard first.`,
    };
  }

  if (!tmpl.config || typeof tmpl.config !== "object" || Array.isArray(tmpl.config)) {
    return {
      ok: false,
      error: `Active template for "${distributor.name}" has no column mapping config. Complete template setup before uploading.`,
    };
  }

  return {
    ok: true,
    context: {
      distributor: {
        id: distributor.id,
        code: distributor.code,
        name: distributor.name,
        pdfFormatId: distributor.pdfFormatId,
        pdfFormat: {
          id: distributor.pdfFormat.id,
          code: distributor.pdfFormat.code,
          name: distributor.pdfFormat.name,
          family: distributor.pdfFormat.family,
        },
      },
      template: {
        id: tmpl.id,
        lastSuccessfulRowCount: tmpl.lastSuccessfulRowCount,
      },
      templateConfig: tmpl.config as unknown as import("@/lib/pdf-template-types").TemplateConfig,
    },
  };
}

/** Active PDF extraction template for a distributor (highest version if multiple active). */
export async function getActiveDistributorTemplate(distributorId: string) {
  return prisma.distributorTemplate.findFirst({
    where: { distributorId, isActive: true },
    orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
  });
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

/** Resolve distributor from PDF worker hints (name from report header). */
export async function findDistributorByExtractHints(hint: {
  distributor_hint?: string;
  distributor_name_hint?: string | null;
  suggested_format_code?: string | null;
}) {
  const code = hint.distributor_hint;
  if (code && !code.startsWith("fmt-") && code !== "generic" && code !== "config") {
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
