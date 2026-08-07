import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/storage";
import { extractPdf, getPdfDistributorHint, matchRows } from "@/lib/pdf-worker";
import { expandUploadFiles } from "@/lib/zip-utils";
import { DocumentStatus, ExtractedRowStatus } from "@prisma/client";

import {
  getDemoUserId,
  findDistributorByExtractHints,
  loadDistributorUploadContext,
  TEMPLATE_MISMATCH_MESSAGE,
  type DistributorUploadContext,
} from "@/lib/db-helpers";
import { detectTemplateMismatch } from "@/lib/template-mismatch";
import { parseIsoDate, todayIsoDate, isFutureDate } from "@/lib/date-utils";
import type { ExtractMethod } from "@/lib/pdf-template-types";

function formatExtractMethod(method: ExtractMethod | undefined): string {
  if (method === "line_fallback") return "Line parser fallback";
  if (method === "alternate_settings") return "Alternate pdfplumber settings";
  if (method === "table") return "Table extraction";
  return "Unknown";
}

function mapRowStatus(matchStatus: string): ExtractedRowStatus {
  if (matchStatus === "matched") return "MATCHED";
  if (matchStatus === "review") return "UNMATCHED";
  return "UNMATCHED";
}

function mapDocumentStatus(
  matched: number,
  review: number,
  unknown: number,
  templateMismatch: boolean,
  failed: boolean
): DocumentStatus {
  if (failed) return "FAILED";
  if (templateMismatch) return "TEMPLATE_MISMATCH";
  if (review > 0 || unknown > 0) return "REVIEW_REQUIRED";
  if (matched > 0) return "EXTRACTED";
  return "EXTRACTED";
}

type UploadFileResult = {
  id: string;
  fileName: string;
  status: string;
  rowCount: number;
  matchedCount: number;
  extractMethod?: ExtractMethod;
  error?: string;
  distributorId?: string;
  distributorName?: string;
  suggestedDistributorId?: string;
  suggestedDistributorName?: string;
};

type FileUploadContextResult =
  | { ok: true; context: DistributorUploadContext }
  | {
      ok: false;
      error: string;
      suggestedDistributorId?: string;
      suggestedDistributorName?: string;
    };

async function resolveFileUploadContext(
  buffer: Buffer,
  fileName: string,
  forceContext: DistributorUploadContext | null
): Promise<FileUploadContextResult> {
  if (forceContext) {
    return { ok: true, context: forceContext };
  }

  const hint = await getPdfDistributorHint(buffer, fileName);
  const matched = await findDistributorByExtractHints({
    distributor_name_hint: hint.distributor_name_hint,
  });

  if (!matched) {
    const nameHint = hint.distributor_name_hint?.trim();
    return {
      ok: false,
      error: nameHint
        ? `Could not match distributor from PDF header: "${nameHint}".`
        : "Could not detect distributor from PDF header.",
      suggestedDistributorName: nameHint || undefined,
    };
  }

  const loaded = await loadDistributorUploadContext(matched.id);
  if (!loaded.ok) {
    return {
      ok: false,
      error: loaded.error,
      suggestedDistributorId: matched.id,
      suggestedDistributorName: matched.name,
    };
  }

  return { ok: true, context: loaded.context };
}

async function failDocument(
  documentId: string,
  runId: string,
  status: DocumentStatus,
  message: string
) {
  await prisma.extractionRun.update({
    where: { id: runId },
    data: { status: "FAILED", completedAt: new Date(), errorMessage: message },
  });
  await prisma.document.update({
    where: { id: documentId },
    data: { status },
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    const forceDistributorId =
      (formData.get("forceDistributorId") as string) ||
      (formData.get("distributorId") as string) ||
      null;
    const reportDateRaw = (formData.get("reportDate") as string) || todayIsoDate();

    const reportDate = parseIsoDate(reportDateRaw);
    if (!reportDate) {
      return NextResponse.json({ error: "Invalid reportDate — use YYYY-MM-DD" }, { status: 400 });
    }
    if (isFutureDate(reportDate)) {
      return NextResponse.json({ error: "reportDate cannot be in the future" }, { status: 400 });
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No PDF or ZIP files provided" }, { status: 400 });
    }

    const expanded = await expandUploadFiles(files);
    if (expanded.length === 0) {
      return NextResponse.json({ error: "No PDF files found in upload" }, { status: 400 });
    }

    const userId = await getDemoUserId();

    let forceUploadContext: DistributorUploadContext | null = null;
    if (forceDistributorId) {
      const loaded = await loadDistributorUploadContext(forceDistributorId);
      if (!loaded.ok) {
        return NextResponse.json({ error: loaded.error }, { status: 400 });
      }
      forceUploadContext = loaded.context;
    }

    const results: UploadFileResult[] = [];
    const warnings: string[] = [];

    for (const file of expanded) {
      const buffer = file.buffer;

      const resolved = await resolveFileUploadContext(buffer, file.name, forceUploadContext);
      if (!resolved.ok) {
        results.push({
          id: "",
          fileName: file.name,
          status: "FAILED",
          rowCount: 0,
          matchedCount: 0,
          error: resolved.error,
          suggestedDistributorId: resolved.suggestedDistributorId,
          suggestedDistributorName: resolved.suggestedDistributorName,
        });
        continue;
      }

      const fileContext = resolved.context;
      const fileDistributor = fileContext.distributor;

      const dup = await prisma.document.findFirst({
        where: {
          distributorId: fileDistributor.id,
          reportDate,
          status: "APPROVED",
        },
      });
      if (dup) {
        warnings.push(
          `An approved document already exists for ${fileDistributor.name} on ${reportDateRaw} (${dup.fileName})`
        );
      }

      const { filePath, fileHash, fileSize } = await saveUploadedFile(buffer, file.name);

      const document = await prisma.document.create({
        data: {
          fileName: file.name,
          filePath,
          fileHash,
          fileSize,
          status: "UPLOADED",
          distributorId: fileDistributor.id,
          templateId: fileContext.template.id,
          uploadedById: userId,
          reportDate,
        },
      });

      const run = await prisma.extractionRun.create({
        data: {
          documentId: document.id,
          status: "RUNNING",
          startedAt: new Date(),
        },
      });

      await prisma.document.update({
        where: { id: document.id },
        data: { status: "PROCESSING" },
      });

      try {
        const extractResult = await extractPdf(buffer, file.name, {
          distributorCode: fileDistributor.code,
          formatCode: fileContext.distributor.pdfFormat.code,
          templateConfig: fileContext.templateConfig,
        });

        const extractMethod = (extractResult.extract_method ?? "table") as ExtractMethod;
        const rowCount = extractResult.rows.length;
        const templateMismatch = detectTemplateMismatch({
          rowCount,
          lastSuccessfulRowCount: fileContext.template.lastSuccessfulRowCount,
          needsTemplateRemap: extractResult.needs_template_remap,
          templateResolutionOk: extractResult.template_resolution_ok,
        });
        const resolutionFailed =
          extractResult.needs_template_remap === true || extractResult.template_resolution_ok === false;

        if (templateMismatch) {
          const reason = extractResult.needs_template_remap
            ? "PDF layout could not be parsed with the saved template — manual template re-map required."
            : resolutionFailed
            ? "Column headers could not be resolved from the saved template mapping."
            : `Extracted ${rowCount} rows vs ${fileContext.template.lastSuccessfulRowCount} on last approved upload (>30% drop).`;

          await failDocument(
            document.id,
            run.id,
            "TEMPLATE_MISMATCH",
            `${TEMPLATE_MISMATCH_MESSAGE} — ${reason}`
          );

          await prisma.extractionRun.update({
            where: { id: run.id },
            data: { extractMethod },
          });

          results.push({
            id: document.id,
            fileName: file.name,
            status: "TEMPLATE_MISMATCH",
            rowCount,
            matchedCount: 0,
            extractMethod,
            error: TEMPLATE_MISMATCH_MESSAGE,
            distributorId: fileDistributor.id,
            distributorName: fileDistributor.name,
          });
          continue;
        }

        const [mappings, products, aliases] = await Promise.all([
          prisma.distributorProductMapping.findMany({ where: { distributorId: fileDistributor.id } }),
          prisma.product.findMany({ where: { isActive: true } }),
          prisma.productAlias.findMany(),
        ]);

        const matchResult = await matchRows({
          rows: extractResult.rows,
          distributor_id: fileDistributor.id,
          mappings: mappings.map((m) => ({
            raw_product_text: m.rawProductText,
            product_id: m.productId,
            confidence: m.confidence,
          })),
          products: products.map((p) => ({ id: p.id, sku: p.sku, name: p.name })),
          aliases: aliases.map((a) => ({ alias: a.alias, product_id: a.productId })),
        });

        if (matchResult.rows.length > 0) {
          await prisma.extractedRow.createMany({
            data: matchResult.rows.map((row, index) => ({
              extractionRunId: run.id,
              rowIndex: index + 1,
              rawProductText: row.raw_product_text,
              quantity: row.quantity ?? 0,
              unitPrice: row.unit_price ?? null,
              lineTotal: row.gross_value ?? null,
              closingStock: row.closing_stock ?? null,
              returnsQty: row.returns_qty ?? null,
              status: mapRowStatus(row.match_status),
              productId: row.match_status === "matched" ? row.suggested_product_id : null,
              distributorId: fileDistributor.id,
            })),
          });
        }

        const failed = matchResult.rows.length === 0;
        const docStatus = mapDocumentStatus(
          matchResult.matched_count,
          matchResult.review_count,
          matchResult.unknown_count,
          false,
          failed
        );

        await prisma.extractionRun.update({
          where: { id: run.id },
          data: {
            status: failed ? "FAILED" : "COMPLETED",
            completedAt: new Date(),
            rowCount: matchResult.rows.length,
            matchedCount: matchResult.matched_count,
            extractMethod,
            errorMessage: failed
              ? `No rows extracted (${formatExtractMethod(extractMethod)})`
              : null,
          },
        });

        await prisma.document.update({
          where: { id: document.id },
          data: { status: docStatus },
        });

        results.push({
          id: document.id,
          fileName: file.name,
          status: docStatus,
          rowCount: matchResult.rows.length,
          matchedCount: matchResult.matched_count,
          extractMethod,
          distributorId: fileDistributor.id,
          distributorName: fileDistributor.name,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Extraction failed";

        await prisma.extractionRun.update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            errorMessage: message,
          },
        });

        await prisma.document.update({
          where: { id: document.id },
          data: { status: "FAILED" },
        });

        results.push({
          id: document.id,
          fileName: file.name,
          status: "FAILED",
          rowCount: 0,
          matchedCount: 0,
          error: message,
          distributorId: fileDistributor.id,
          distributorName: fileDistributor.name,
        });
      }
    }

    const hardFailures = results.filter((r) => r.status === "FAILED" && !r.id);
    if (hardFailures.length === results.length && hardFailures.length > 0) {
      return NextResponse.json(
        {
          error: hardFailures[0].error ?? "Upload failed",
          documents: results,
          warnings: warnings.length > 0 ? warnings : undefined,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ documents: results, warnings: warnings.length > 0 ? warnings : undefined });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
