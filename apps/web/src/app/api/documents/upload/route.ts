import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/storage";
import { extractPdf, getPdfDistributorHint, matchRows } from "@/lib/pdf-worker";
import type { ExtractedRowPayload } from "@/lib/pdf-worker";
import { expandUploadFiles, mimeTypeForUploadKind } from "@/lib/zip-utils";
import { DocumentStatus, ExtractedRowStatus } from "@prisma/client";
import { parseSalesExcel } from "@/lib/sales-excel-import";

import {
  getDemoUserId,
  findDistributorByExtractHints,
  loadDistributorUploadContext,
  TEMPLATE_MISMATCH_MESSAGE,
  type DistributorUploadContext,
} from "@/lib/db-helpers";
import {
  findDistributorByFilename,
  type FilenameDistributorCandidate,
} from "@/lib/filename-distributor-match";
import { detectTemplateMismatch } from "@/lib/template-mismatch";
import { parseIsoDate, todayIsoDate, isFutureDate } from "@/lib/date-utils";
import { replacePriorDocumentsForDistributorDate } from "@/lib/document-replace";
import type { ExtractMethod } from "@/lib/pdf-template-types";

function formatExtractMethod(method: ExtractMethod | undefined): string {
  if (method === "line_fallback") return "Line parser fallback";
  if (method === "alternate_settings") return "Alternate pdfplumber settings";
  if (method === "geometry") return "Geometry table builder";
  if (method === "table") return "Table extraction";
  if (method === "excel") return "Excel import";
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
      candidates?: FilenameDistributorCandidate[];
    };

async function loadPdfContextForDistributor(
  distributorId: string,
  distributorName?: string
): Promise<FileUploadContextResult> {
  const loaded = await loadDistributorUploadContext(distributorId);
  if (!loaded.ok) {
    return {
      ok: false,
      error: loaded.error,
      suggestedDistributorId: distributorId,
      suggestedDistributorName: distributorName,
    };
  }
  if (loaded.context.distributor.inputMode === "EXCEL_ONLY") {
    return {
      ok: false,
      error: "This distributor requires Excel upload",
      suggestedDistributorId: loaded.context.distributor.id,
      suggestedDistributorName: loaded.context.distributor.name,
    };
  }
  return { ok: true, context: loaded.context };
}

async function resolvePdfUploadContext(
  buffer: Buffer,
  fileName: string,
  forceContext: DistributorUploadContext | null,
  distributors: FilenameDistributorCandidate[]
): Promise<FileUploadContextResult> {
  if (forceContext) {
    if (forceContext.distributor.inputMode === "EXCEL_ONLY") {
      return {
        ok: false,
        error: "This distributor requires Excel upload",
        suggestedDistributorId: forceContext.distributor.id,
        suggestedDistributorName: forceContext.distributor.name,
      };
    }
    return { ok: true, context: forceContext };
  }

  const hint = await getPdfDistributorHint(buffer, fileName);
  const matched = await findDistributorByExtractHints({
    distributor_name_hint: hint.distributor_name_hint,
  });

  if (matched) {
    return loadPdfContextForDistributor(matched.id, matched.name);
  }

  // Fallback: match distributor from filename when PDF header fails
  const byFilename = findDistributorByFilename(fileName, distributors);
  if (byFilename.ok) {
    return loadPdfContextForDistributor(byFilename.distributor.id, byFilename.distributor.name);
  }

  const nameHint = hint.distributor_name_hint?.trim();
  return {
    ok: false,
    error: nameHint
      ? `Could not match distributor from PDF header: "${nameHint}". ${byFilename.error}`
      : byFilename.error,
    suggestedDistributorName: nameHint || undefined,
    candidates: byFilename.candidates,
  };
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

async function matchAndPersistRows(params: {
  rows: ExtractedRowPayload[];
  distributorId: string;
  runId: string;
  documentId: string;
  extractMethod: ExtractMethod;
  lastSuccessfulRowCount: number | null;
  needsTemplateRemap?: boolean;
  templateResolutionOk?: boolean;
}): Promise<UploadFileResult & { distributorId: string; distributorName?: string }> {
  const {
    rows,
    distributorId,
    runId,
    documentId,
    extractMethod,
    lastSuccessfulRowCount,
    needsTemplateRemap,
    templateResolutionOk,
  } = params;

  const rowCount = rows.length;
  const templateMismatch = detectTemplateMismatch({
    rowCount,
    lastSuccessfulRowCount,
    needsTemplateRemap,
    templateResolutionOk,
  });

  const distributor = await prisma.distributor.findUnique({
    where: { id: distributorId },
    select: { id: true, name: true },
  });

  if (templateMismatch) {
    const reason =
      needsTemplateRemap
        ? "Layout could not be parsed with the saved template — manual template re-map required."
        : templateResolutionOk === false
          ? "Column headers could not be resolved from the saved template mapping."
          : `Extracted ${rowCount} rows vs ${lastSuccessfulRowCount} on last approved upload (>30% drop).`;

    await failDocument(
      documentId,
      runId,
      "TEMPLATE_MISMATCH",
      `${TEMPLATE_MISMATCH_MESSAGE} — ${reason}`
    );

    await prisma.extractionRun.update({
      where: { id: runId },
      data: { extractMethod },
    });

    return {
      id: documentId,
      fileName: "",
      status: "TEMPLATE_MISMATCH",
      rowCount,
      matchedCount: 0,
      extractMethod,
      error: TEMPLATE_MISMATCH_MESSAGE,
      distributorId,
      distributorName: distributor?.name,
    };
  }

  const [mappings, products, aliases] = await Promise.all([
    prisma.distributorProductMapping.findMany({ where: { distributorId } }),
    prisma.product.findMany({ where: { isActive: true } }),
    prisma.productAlias.findMany(),
  ]);

  const matchResult = await matchRows({
    rows,
    distributor_id: distributorId,
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
        extractionRunId: runId,
        rowIndex: index + 1,
        rawProductText: row.raw_product_text,
        quantity: row.quantity ?? 0,
        unitPrice: row.unit_price ?? null,
        lineTotal: row.gross_value ?? null,
        closingStock: row.closing_stock ?? null,
        returnsQty: row.returns_qty ?? null,
        status: mapRowStatus(row.match_status),
        productId: row.match_status === "matched" ? row.suggested_product_id : null,
        distributorId,
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
    where: { id: runId },
    data: {
      status: failed ? "FAILED" : "COMPLETED",
      completedAt: new Date(),
      rowCount: matchResult.rows.length,
      matchedCount: matchResult.matched_count,
      extractMethod,
      errorMessage: failed ? `No rows extracted (${formatExtractMethod(extractMethod)})` : null,
    },
  });

  await prisma.document.update({
    where: { id: documentId },
    data: { status: docStatus },
  });

  return {
    id: documentId,
    fileName: "",
    status: docStatus,
    rowCount: matchResult.rows.length,
    matchedCount: matchResult.matched_count,
    extractMethod,
    distributorId,
    distributorName: distributor?.name,
  };
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
      return NextResponse.json({ error: "No PDF, ZIP, or Excel files provided" }, { status: 400 });
    }

    const expanded = await expandUploadFiles(files);
    if (expanded.length === 0) {
      return NextResponse.json(
        { error: "No PDF or Excel (.xlsx) files found in upload" },
        { status: 400 }
      );
    }

    const userId = await getDemoUserId();

    const distributorRows = await prisma.distributor.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, inputMode: true, isActive: true },
    });
    const distributors: FilenameDistributorCandidate[] = distributorRows;

    let forcePdfContext: DistributorUploadContext | null = null;
    let forceExcelContext: DistributorUploadContext | null = null;
    let forceExcelOnly = false;
    const excelContextCache = new Map<string, DistributorUploadContext>();

    if (forceDistributorId) {
      const forceDist = await prisma.distributor.findUnique({
        where: { id: forceDistributorId },
        select: { id: true, name: true, inputMode: true },
      });
      if (!forceDist) {
        return NextResponse.json({ error: "Distributor not found" }, { status: 400 });
      }

      forceExcelOnly = forceDist.inputMode === "EXCEL_ONLY";
      const hasXlsx = expanded.some((f) => f.kind === "xlsx");
      const hasPdf = expanded.some((f) => f.kind === "pdf");

      if (hasXlsx) {
        const loadedExcel = await loadDistributorUploadContext(forceDistributorId, {
          forExcel: true,
        });
        if (!loadedExcel.ok) {
          return NextResponse.json({ error: loadedExcel.error }, { status: 400 });
        }
        forceExcelContext = loadedExcel.context;
        excelContextCache.set(forceDistributorId, loadedExcel.context);
      }

      // PDF force only when distributor accepts PDFs; EXCEL_ONLY PDFs fail per-file below
      if (hasPdf && !forceExcelOnly) {
        const loaded = await loadDistributorUploadContext(forceDistributorId);
        if (!loaded.ok) {
          return NextResponse.json({ error: loaded.error }, { status: 400 });
        }
        forcePdfContext = loaded.context;
      }
    }

    const getExcelContextForDistributor = async (
      distributorId: string
    ): Promise<FileUploadContextResult> => {
      const cached = excelContextCache.get(distributorId);
      if (cached) return { ok: true, context: cached };
      const loaded = await loadDistributorUploadContext(distributorId, { forExcel: true });
      if (!loaded.ok) {
        return { ok: false, error: loaded.error };
      }
      excelContextCache.set(distributorId, loaded.context);
      return { ok: true, context: loaded.context };
    };

    const results: UploadFileResult[] = [];
    const warnings: string[] = [];

    for (const file of expanded) {
      const buffer = file.buffer;

      if (file.kind === "xlsx") {
        let fileContext: DistributorUploadContext | null = forceExcelContext;

        if (!fileContext) {
          const filenameMatch = findDistributorByFilename(file.name, distributors);
          if (!filenameMatch.ok) {
            results.push({
              id: "",
              fileName: file.name,
              status: "FAILED",
              rowCount: 0,
              matchedCount: 0,
              error: filenameMatch.error,
              suggestedDistributorName: filenameMatch.candidates
                ?.map((c) => c.name)
                .join(", "),
            });
            continue;
          }

          const loaded = await getExcelContextForDistributor(filenameMatch.distributor.id);
          if (!loaded.ok) {
            results.push({
              id: "",
              fileName: file.name,
              status: "FAILED",
              rowCount: 0,
              matchedCount: 0,
              error: loaded.error,
              suggestedDistributorId: filenameMatch.distributor.id,
              suggestedDistributorName: filenameMatch.distributor.name,
            });
            continue;
          }
          fileContext = loaded.context;
        }

        const fileDistributor = fileContext.distributor;
        const excelConfig = fileContext.template.excelConfig;
        if (!excelConfig) {
          results.push({
            id: "",
            fileName: file.name,
            status: "FAILED",
            rowCount: 0,
            matchedCount: 0,
            error: `Excel column map for "${fileDistributor.name}" is not configured`,
            distributorId: fileDistributor.id,
            distributorName: fileDistributor.name,
          });
          continue;
        }

        const replaced = await replacePriorDocumentsForDistributorDate({
          distributorId: fileDistributor.id,
          reportDate,
        });
        if (replaced.length > 0) {
          const names = replaced.map((d) => d.fileName).join(", ");
          warnings.push(
            `Replaced ${replaced.length} prior document(s) for ${fileDistributor.name} on ${reportDateRaw} (${names}). Re-approve to refresh SSR data.`
          );
        }

        const { filePath, fileHash, fileSize } = await saveUploadedFile(buffer, file.name);

        const document = await prisma.document.create({
          data: {
            fileName: file.name,
            filePath,
            fileHash,
            fileSize,
            mimeType: mimeTypeForUploadKind("xlsx"),
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
          const rows = await parseSalesExcel(buffer, excelConfig);
          const persisted = await matchAndPersistRows({
            rows,
            distributorId: fileDistributor.id,
            runId: run.id,
            documentId: document.id,
            extractMethod: "excel",
            lastSuccessfulRowCount: fileContext.template.lastSuccessfulRowCount,
          });
          results.push({ ...persisted, fileName: file.name });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Excel parse failed";
          await prisma.extractionRun.update({
            where: { id: run.id },
            data: {
              status: "FAILED",
              completedAt: new Date(),
              errorMessage: message,
              extractMethod: "excel",
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
            extractMethod: "excel",
            error: message,
            distributorId: fileDistributor.id,
            distributorName: fileDistributor.name,
          });
        }
        continue;
      }

      // PDF path — forced EXCEL_ONLY rejects PDFs per-file (e.g. mixed ZIP)
      if (forceDistributorId && forceExcelOnly) {
        results.push({
          id: "",
          fileName: file.name,
          status: "FAILED",
          rowCount: 0,
          matchedCount: 0,
          error: "This distributor requires Excel upload",
          distributorId: forceDistributorId,
        });
        continue;
      }

      const resolved = await resolvePdfUploadContext(
        buffer,
        file.name,
        forcePdfContext,
        distributors
      );
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

      if (fileDistributor.inputMode === "EXCEL_ONLY") {
        results.push({
          id: "",
          fileName: file.name,
          status: "FAILED",
          rowCount: 0,
          matchedCount: 0,
          error: "This distributor requires Excel upload",
          distributorId: fileDistributor.id,
          distributorName: fileDistributor.name,
        });
        continue;
      }

      const replaced = await replacePriorDocumentsForDistributorDate({
        distributorId: fileDistributor.id,
        reportDate,
      });
      if (replaced.length > 0) {
        const names = replaced.map((d) => d.fileName).join(", ");
        warnings.push(
          `Replaced ${replaced.length} prior document(s) for ${fileDistributor.name} on ${reportDateRaw} (${names}). Re-approve to refresh SSR data.`
        );
      }

      const { filePath, fileHash, fileSize } = await saveUploadedFile(buffer, file.name);

      const document = await prisma.document.create({
        data: {
          fileName: file.name,
          filePath,
          fileHash,
          fileSize,
          mimeType: mimeTypeForUploadKind("pdf"),
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
        const persisted = await matchAndPersistRows({
          rows: extractResult.rows,
          distributorId: fileDistributor.id,
          runId: run.id,
          documentId: document.id,
          extractMethod,
          lastSuccessfulRowCount: fileContext.template.lastSuccessfulRowCount,
          needsTemplateRemap: extractResult.needs_template_remap,
          templateResolutionOk: extractResult.template_resolution_ok,
        });
        results.push({ ...persisted, fileName: file.name });
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

    return NextResponse.json({
      documents: results,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
