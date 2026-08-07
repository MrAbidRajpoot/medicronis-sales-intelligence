import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/storage";
import { extractPdf, matchRows } from "@/lib/pdf-worker";
import { expandUploadFiles } from "@/lib/zip-utils";
import { DocumentStatus, ExtractedRowStatus } from "@prisma/client";

import { getDemoUserId, findDistributorByExtractHints } from "@/lib/db-helpers";
import { parseIsoDate, todayIsoDate, isFutureDate } from "@/lib/date-utils";

function mapRowStatus(matchStatus: string): ExtractedRowStatus {
  if (matchStatus === "matched") return "MATCHED";
  if (matchStatus === "review") return "UNMATCHED";
  return "UNMATCHED";
}

function mapDocumentStatus(matched: number, review: number, unknown: number, failed: boolean): DocumentStatus {
  if (failed) return "FAILED";
  if (review > 0 || unknown > 0) return "REVIEW_REQUIRED";
  if (matched > 0) return "EXTRACTED";
  return "EXTRACTED";
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    const distributorId = (formData.get("distributorId") as string) || null;
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

    let distributor = distributorId
      ? await prisma.distributor.findUnique({ where: { id: distributorId } })
      : null;

    const results: { id: string; fileName: string; status: string; rowCount: number; matchedCount: number }[] = [];
    const warnings: string[] = [];

    if (distributorId) {
      const existing = await prisma.document.findFirst({
        where: {
          distributorId,
          reportDate,
          status: "APPROVED",
        },
      });
      if (existing) {
        warnings.push(
          `An approved document already exists for this distributor on ${reportDateRaw} (${existing.fileName})`
        );
      }
    }

    for (const file of expanded) {
      const buffer = file.buffer;
      const { filePath, fileHash, fileSize } = await saveUploadedFile(buffer, file.name);

      const document = await prisma.document.create({
        data: {
          fileName: file.name,
          filePath,
          fileHash,
          fileSize,
          status: "UPLOADED",
          distributorId: distributor?.id ?? null,
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
        const extractResult = await extractPdf(
          buffer,
          file.name,
          distributor?.code ?? null
        );

        if (!distributor) {
          const detected = await findDistributorByExtractHints({
            distributor_hint: extractResult.distributor_hint,
            distributor_name_hint: extractResult.distributor_name_hint,
          });
          if (detected) {
            distributor = detected;
            await prisma.document.update({
              where: { id: document.id },
              data: { distributorId: detected.id },
            });

            const dup = await prisma.document.findFirst({
              where: {
                distributorId: detected.id,
                reportDate,
                status: "APPROVED",
                id: { not: document.id },
              },
            });
            if (dup) {
              warnings.push(
                `An approved document already exists for ${detected.name} on ${reportDateRaw} (${dup.fileName})`
              );
            }
          }
        }

        const distId = distributor?.id ?? document.distributorId;

        const [mappings, products, aliases] = await Promise.all([
          distId
            ? prisma.distributorProductMapping.findMany({ where: { distributorId: distId } })
            : Promise.resolve([]),
          prisma.product.findMany({ where: { isActive: true } }),
          prisma.productAlias.findMany(),
        ]);

        const matchResult = await matchRows({
          rows: extractResult.rows,
          distributor_id: distId,
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
              status: mapRowStatus(row.match_status),
              productId: row.match_status === "matched" ? row.suggested_product_id : null,
              distributorId: distId,
            })),
          });
        }

        const docStatus = mapDocumentStatus(
          matchResult.matched_count,
          matchResult.review_count,
          matchResult.unknown_count,
          matchResult.rows.length === 0
        );

        await prisma.extractionRun.update({
          where: { id: run.id },
          data: {
            status: matchResult.rows.length === 0 ? "FAILED" : "COMPLETED",
            completedAt: new Date(),
            rowCount: matchResult.rows.length,
            matchedCount: matchResult.matched_count,
            errorMessage:
              matchResult.rows.length === 0
                ? `No rows extracted (template: ${extractResult.template_used})`
                : null,
          },
        });

        await prisma.document.update({
          where: { id: document.id },
          data: {
            status: docStatus,
          },
        });

        results.push({
          id: document.id,
          fileName: file.name,
          status: docStatus,
          rowCount: matchResult.rows.length,
          matchedCount: matchResult.matched_count,
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
        });
      }
    }

    return NextResponse.json({ documents: results, warnings: warnings.length > 0 ? warnings : undefined });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
