import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalculateDocumentStatus } from "@/lib/db-helpers";
import {
  buildProductDataFields,
  isValidBonus,
  parseOptionalDecimal,
  parseOptionalInt,
  resolveManufacturerId,
  serializeProductDecimals,
} from "@/lib/product-helpers";

export const dynamic = "force-dynamic";

function mapProduct(p: {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  composition: string | null;
  manufacturerId: string | null;
  shipperSize: number | null;
  mrp: { toString(): string } | null;
  tp: { toString(): string } | null;
  oldSp: { toString(): string } | null;
  newSp: { toString(): string } | null;
  netPrice: { toString(): string } | null;
  tax: { toString(): string } | null;
  netPriceWith1Pct: { toString(): string } | null;
  bonus: string | null;
  isActive: boolean;
  createdAt: Date;
  manufacturer?: { name: string } | null;
  aliases: { alias: string }[];
  _count: { salesLines: number };
}) {
  return {
    ...serializeProductDecimals(p),
    manufacturerName: p.manufacturer?.name ?? null,
    aliases: p.aliases.map((a) => a.alias),
    salesLineCount: p._count.salesLines,
  };
}

export async function GET(request: NextRequest) {
  const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";
  const full = request.nextUrl.searchParams.get("full") === "1";

  if (full || includeInactive) {
    const products = await prisma.product.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: "asc" },
      include: {
        aliases: true,
        manufacturer: { select: { name: true } },
        _count: { select: { salesLines: true } },
      },
    });

    return NextResponse.json(products.map(mapProduct));
  }

  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, sku: true, name: true },
  });

  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sku,
      name,
      category,
      composition,
      manufacturerId,
      manufacturerName,
      shipperSize,
      mrp,
      tp,
      oldSp,
      newSp,
      netPrice,
      tax,
      netPriceWith1Pct,
      bonus,
      alias,
      reviewRowId,
    } = body as Record<string, unknown>;

    if (!String(sku ?? "").trim() || !String(name ?? "").trim()) {
      return NextResponse.json({ error: "SKU and name are required" }, { status: 400 });
    }

    const bonusValue = bonus != null ? String(bonus) : null;
    if (!isValidBonus(bonusValue)) {
      return NextResponse.json({ error: "Bonus must be in format e.g. 4+1" }, { status: 400 });
    }

    const existing = await prisma.product.findUnique({ where: { sku: String(sku).trim() } });
    if (existing) {
      return NextResponse.json({ error: "Product SKU already exists" }, { status: 409 });
    }

    const resolvedManufacturerId = await resolveManufacturerId(
      prisma,
      manufacturerId as string | null | undefined,
      manufacturerName as string | null | undefined
    );

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          sku: String(sku).trim().toUpperCase(),
          name: String(name).trim(),
          category: category ? String(category).trim() || null : null,
          ...(resolvedManufacturerId !== undefined && { manufacturerId: resolvedManufacturerId }),
          ...buildProductDataFields({
            composition: composition as string | null | undefined,
            shipperSize: parseOptionalInt(shipperSize) ?? null,
            mrp: parseOptionalDecimal(mrp) != null ? Number(parseOptionalDecimal(mrp)) : null,
            tp: parseOptionalDecimal(tp) != null ? Number(parseOptionalDecimal(tp)) : null,
            oldSp: parseOptionalDecimal(oldSp) != null ? Number(parseOptionalDecimal(oldSp)) : null,
            newSp: parseOptionalDecimal(newSp) != null ? Number(parseOptionalDecimal(newSp)) : null,
            netPrice: parseOptionalDecimal(netPrice) != null ? Number(parseOptionalDecimal(netPrice)) : null,
            tax: parseOptionalDecimal(tax) != null ? Number(parseOptionalDecimal(tax)) : null,
            netPriceWith1Pct:
              parseOptionalDecimal(netPriceWith1Pct) != null
                ? Number(parseOptionalDecimal(netPriceWith1Pct))
                : null,
            bonus: bonusValue,
          }),
        },
        include: { manufacturer: { select: { name: true } } },
      });

      const aliasTexts = new Set<string>();
      if (alias && String(alias).trim()) aliasTexts.add(String(alias).trim());
      if (String(name).trim()) aliasTexts.add(String(name).trim());

      if (reviewRowId) {
        const row = await tx.extractedRow.findUnique({
          where: { id: String(reviewRowId) },
          include: { extractionRun: { include: { document: true } } },
        });

        if (row) {
          aliasTexts.add(row.rawProductText);
          const distributorId = row.distributorId ?? row.extractionRun.document.distributorId;

          await tx.extractedRow.update({
            where: { id: String(reviewRowId) },
            data: { status: "REVIEWED", productId: created.id },
          });

          if (distributorId) {
            await tx.distributorProductMapping.upsert({
              where: {
                distributorId_rawProductText: {
                  distributorId,
                  rawProductText: row.rawProductText,
                },
              },
              update: { productId: created.id, confidence: 1, isVerified: true },
              create: {
                distributorId,
                rawProductText: row.rawProductText,
                productId: created.id,
                confidence: 1,
                isVerified: true,
              },
            });
          }
        }
      }

      for (const aliasText of Array.from(aliasTexts)) {
        await tx.productAlias.upsert({
          where: { productId_alias: { productId: created.id, alias: aliasText } },
          update: {},
          create: { productId: created.id, alias: aliasText },
        });
      }

      return created;
    });

    if (reviewRowId) {
      const row = await prisma.extractedRow.findUnique({
        where: { id: String(reviewRowId) },
        include: { extractionRun: true },
      });
      if (row) {
        await recalculateDocumentStatus(row.extractionRun.documentId);
      }
    }

    return NextResponse.json(serializeProductDecimals(product), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
