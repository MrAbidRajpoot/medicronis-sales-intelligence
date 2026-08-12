import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildProductDataFields,
  isValidBonus,
  parseOptionalDecimal,
  parseOptionalInt,
  resolveManufacturerId,
  resolveProductGroupId,
  serializeProductDecimals,
} from "@/lib/product-helpers";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      aliases: true,
      manufacturer: { select: { id: true, name: true } },
      productGroup: { select: { id: true, name: true } },
      _count: { select: { salesLines: true, extractedRows: true } },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...serializeProductDecimals(product),
    aliases: product.aliases.map((a) => a.alias),
    manufacturerName: product.manufacturer?.name ?? null,
    productGroupId: product.productGroupId,
    productGroupName: product.productGroup?.name ?? null,
    salesLineCount: product._count.salesLines,
    extractedRowCount: product._count.extractedRows,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const {
      sku,
      name,
      category,
      composition,
      manufacturerId,
      manufacturerName,
      productGroupId,
      groupName,
      shipperSize,
      mrp,
      tp,
      oldSp,
      newSp,
      netPrice,
      tax,
      netPriceWith1Pct,
      bonus,
      isActive,
      aliases,
    } = body as Record<string, unknown>;

    if (sku) {
      const existing = await prisma.product.findFirst({
        where: { sku: String(sku), NOT: { id: params.id } },
      });
      if (existing) {
        return NextResponse.json({ error: "Product SKU already exists" }, { status: 409 });
      }
    }

    if (bonus !== undefined && !isValidBonus(bonus != null ? String(bonus) : null)) {
      return NextResponse.json({ error: "Bonus must be in format e.g. 4+1" }, { status: 400 });
    }

    let resolvedProductGroupId: string | null | undefined;
    if (productGroupId !== undefined || groupName !== undefined) {
      try {
        resolvedProductGroupId = await resolveProductGroupId(
          prisma,
          productGroupId as string | null | undefined,
          groupName as string | null | undefined
        );
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Invalid product group" },
          { status: 400 }
        );
      }
      if (resolvedProductGroupId === null || resolvedProductGroupId === undefined) {
        return NextResponse.json({ error: "Product group is required" }, { status: 400 });
      }
    }

    const resolvedManufacturerId = await resolveManufacturerId(
      prisma,
      manufacturerId as string | null | undefined,
      manufacturerName as string | null | undefined
    );

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: params.id },
        data: {
          ...(sku !== undefined && { sku: String(sku).trim().toUpperCase() }),
          ...(name !== undefined && { name: String(name).trim() }),
          ...(category !== undefined && { category: category ? String(category).trim() || null : null }),
          ...(resolvedManufacturerId !== undefined && { manufacturerId: resolvedManufacturerId }),
          ...(resolvedProductGroupId !== undefined && { productGroupId: resolvedProductGroupId }),
          ...(isActive !== undefined && { isActive: Boolean(isActive) }),
          ...buildProductDataFields({
            composition: composition as string | null | undefined,
            shipperSize:
              shipperSize !== undefined ? (parseOptionalInt(shipperSize) ?? null) : undefined,
            mrp:
              mrp !== undefined
                ? parseOptionalDecimal(mrp) != null
                  ? Number(parseOptionalDecimal(mrp))
                  : null
                : undefined,
            tp:
              tp !== undefined
                ? parseOptionalDecimal(tp) != null
                  ? Number(parseOptionalDecimal(tp))
                  : null
                : undefined,
            oldSp:
              oldSp !== undefined
                ? parseOptionalDecimal(oldSp) != null
                  ? Number(parseOptionalDecimal(oldSp))
                  : null
                : undefined,
            newSp:
              newSp !== undefined
                ? parseOptionalDecimal(newSp) != null
                  ? Number(parseOptionalDecimal(newSp))
                  : null
                : undefined,
            netPrice:
              netPrice !== undefined
                ? parseOptionalDecimal(netPrice) != null
                  ? Number(parseOptionalDecimal(netPrice))
                  : null
                : undefined,
            tax:
              tax !== undefined
                ? parseOptionalDecimal(tax) != null
                  ? Number(parseOptionalDecimal(tax))
                  : null
                : undefined,
            netPriceWith1Pct:
              netPriceWith1Pct !== undefined
                ? parseOptionalDecimal(netPriceWith1Pct) != null
                  ? Number(parseOptionalDecimal(netPriceWith1Pct))
                  : null
                : undefined,
            bonus: bonus !== undefined ? (bonus != null ? String(bonus).trim() || null : null) : undefined,
          }),
        },
        include: {
          manufacturer: { select: { name: true } },
          productGroup: { select: { id: true, name: true } },
        },
      });

      if (aliases !== undefined) {
        await tx.productAlias.deleteMany({ where: { productId: params.id } });
        const unique = Array.from(
          new Set((aliases as string[]).map((a) => a.trim()).filter(Boolean))
        );
        if (unique.length > 0) {
          await tx.productAlias.createMany({
            data: unique.map((alias) => ({ productId: params.id, alias })),
          });
        }
      }

      return updated;
    });

    return NextResponse.json({
      ...serializeProductDecimals(product),
      manufacturerName: product.manufacturer?.name ?? null,
      productGroupId: product.productGroupId,
      productGroupName: product.productGroup?.name ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const product = await prisma.product.update({
      where: { id: params.id },
      data: { isActive: false },
    });
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 404 });
  }
}
