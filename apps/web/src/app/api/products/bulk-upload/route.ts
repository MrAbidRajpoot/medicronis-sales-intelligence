import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseProductImportFile } from "@/lib/product-import";
import {
  buildProductDataFields,
  resolveManufacturerId,
  resolveProductGroupId,
} from "@/lib/product-helpers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Excel file is required" }, { status: 400 });
    }

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      return NextResponse.json({ error: "Upload a .xlsx Excel file" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const productGroupNames = (
      await prisma.productGroup.findMany({
        where: { isActive: true },
        select: { name: true },
        orderBy: { name: "asc" },
      })
    ).map((group) => group.name);
    const { rows, errors: parseErrors } = await parseProductImportFile(
      buffer,
      productGroupNames
    );

    if (rows.length === 0 && parseErrors.length > 0) {
      return NextResponse.json(
        { error: "No valid rows found", errors: parseErrors },
        { status: 400 }
      );
    }

    const existingSkus = new Set(
      (
        await prisma.product.findMany({
          where: { sku: { in: rows.map((r) => r.sku) } },
          select: { sku: true },
        })
      ).map((p) => p.sku)
    );

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [...parseErrors];

    for (const row of rows) {
      if (existingSkus.has(row.sku)) {
        skipped++;
        errors.push({
          rowNumber: row.rowNumber,
          sku: row.sku,
          message: "SKU already exists in catalog",
        });
        continue;
      }

      try {
        const manufacturerId = await resolveManufacturerId(prisma, null, row.manufacturerName);
        const productGroupId = row.groupName
          ? await resolveProductGroupId(prisma, null, row.groupName)
          : undefined;

        await prisma.$transaction(async (tx) => {
          const product = await tx.product.create({
            data: {
              sku: row.sku,
              name: row.name,
              category: row.category,
              ...(manufacturerId !== undefined && manufacturerId !== null && { manufacturerId }),
              ...(productGroupId !== undefined && productGroupId !== null && { productGroupId }),
              ...buildProductDataFields({
                composition: row.composition,
                shipperSize: row.shipperSize,
                mrp: row.mrp,
                tp: row.tp,
                oldSp: row.oldSp,
                newSp: row.newSp,
                netPrice: row.netPrice,
                tax: row.tax,
                netPriceWith1Pct: row.netPriceWith1Pct,
                bonus: row.bonus,
              }),
            },
          });

          const aliasTexts = new Set<string>([row.name, ...row.aliases]);
          for (const alias of Array.from(aliasTexts)) {
            await tx.productAlias.create({
              data: { productId: product.id, alias },
            });
          }
        });

        existingSkus.add(row.sku);
        created++;
      } catch (err) {
        failed++;
        errors.push({
          rowNumber: row.rowNumber,
          sku: row.sku,
          message: err instanceof Error ? err.message : "Import failed",
        });
      }
    }

    return NextResponse.json({
      created,
      skipped,
      failed,
      total: rows.length,
      errors: errors.slice(0, 20),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bulk upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
