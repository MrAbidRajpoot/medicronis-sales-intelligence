import { Prisma } from "@prisma/client";

export const BONUS_PATTERN = /^\d+\+\d+$/;

export function isValidBonus(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  return BONUS_PATTERN.test(value.trim());
}

export function parseOptionalInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  return n;
}

export function parseOptionalDecimal(value: unknown): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return new Prisma.Decimal(n);
}

export function serializeProductDecimals<
  T extends {
    mrp?: Prisma.Decimal | null;
    tp?: Prisma.Decimal | null;
    oldSp?: Prisma.Decimal | null;
    newSp?: Prisma.Decimal | null;
    netPrice?: Prisma.Decimal | null;
    tax?: Prisma.Decimal | null;
    netPriceWith1Pct?: Prisma.Decimal | null;
  },
>(product: T) {
  return {
    ...product,
    mrp: product.mrp != null ? Number(product.mrp) : null,
    tp: product.tp != null ? Number(product.tp) : null,
    oldSp: product.oldSp != null ? Number(product.oldSp) : null,
    newSp: product.newSp != null ? Number(product.newSp) : null,
    netPrice: product.netPrice != null ? Number(product.netPrice) : null,
    tax: product.tax != null ? Number(product.tax) : null,
    netPriceWith1Pct: product.netPriceWith1Pct != null ? Number(product.netPriceWith1Pct) : null,
  };
}

export interface ProductFieldInput {
  composition?: string | null;
  manufacturerId?: string | null;
  manufacturerName?: string | null;
  shipperSize?: number | null;
  mrp?: number | null;
  tp?: number | null;
  oldSp?: number | null;
  newSp?: number | null;
  netPrice?: number | null;
  tax?: number | null;
  netPriceWith1Pct?: number | null;
  bonus?: string | null;
}

export async function resolveManufacturerId(
  prisma: { manufacturer: { findUnique: Function; create: Function } },
  manufacturerId?: string | null,
  manufacturerName?: string | null
): Promise<string | null | undefined> {
  if (manufacturerName?.trim()) {
    const trimmed = manufacturerName.trim();
    const existing = await prisma.manufacturer.findUnique({ where: { name: trimmed } });
    if (existing) return existing.id;
    const created = await prisma.manufacturer.create({ data: { name: trimmed } });
    return created.id;
  }

  if (manufacturerId === null) return null;
  if (manufacturerId) return manufacturerId;
  return undefined;
}

export const PRODUCT_GROUP_NAMES = ["Medicronis", "Transformer"] as const;

export type ProductGroupName = (typeof PRODUCT_GROUP_NAMES)[number];

export function isValidProductGroupName(name: string): name is ProductGroupName {
  return (PRODUCT_GROUP_NAMES as readonly string[]).includes(name);
}

/** Resolve product group by id or exact name (Medicronis | Transformer). */
export async function resolveProductGroupId(
  prisma: {
    productGroup: {
      findUnique: Function;
      findFirst: Function;
    };
  },
  productGroupId?: string | null,
  groupName?: string | null
): Promise<string | null | undefined> {
  if (groupName != null && String(groupName).trim()) {
    const trimmed = String(groupName).trim();
    if (!isValidProductGroupName(trimmed)) {
      throw new Error(`Group must be one of: ${PRODUCT_GROUP_NAMES.join(" | ")}`);
    }
    const existing = await prisma.productGroup.findUnique({ where: { name: trimmed } });
    if (!existing) {
      throw new Error(`Product group "${trimmed}" not found — run prisma db seed`);
    }
    return existing.id;
  }

  if (productGroupId === null) return null;
  if (productGroupId) {
    const existing = await prisma.productGroup.findUnique({
      where: { id: String(productGroupId) },
    });
    if (!existing) {
      throw new Error("Invalid product group");
    }
    return existing.id;
  }
  return undefined;
}

export function buildProductDataFields(input: ProductFieldInput) {
  const data: Record<string, unknown> = {};

  if (input.composition !== undefined) {
    data.composition = input.composition?.trim() || null;
  }
  if (input.shipperSize !== undefined) {
    data.shipperSize = input.shipperSize;
  }
  if (input.mrp !== undefined) {
    data.mrp = input.mrp != null ? new Prisma.Decimal(input.mrp) : null;
  }
  if (input.tp !== undefined) {
    data.tp = input.tp != null ? new Prisma.Decimal(input.tp) : null;
  }
  if (input.oldSp !== undefined) {
    data.oldSp = input.oldSp != null ? new Prisma.Decimal(input.oldSp) : null;
  }
  if (input.newSp !== undefined) {
    data.newSp = input.newSp != null ? new Prisma.Decimal(input.newSp) : null;
  }
  if (input.netPrice !== undefined) {
    data.netPrice = input.netPrice != null ? new Prisma.Decimal(input.netPrice) : null;
  }
  if (input.tax !== undefined) {
    data.tax = input.tax != null ? new Prisma.Decimal(input.tax) : null;
  }
  if (input.netPriceWith1Pct !== undefined) {
    data.netPriceWith1Pct = input.netPriceWith1Pct != null ? new Prisma.Decimal(input.netPriceWith1Pct) : null;
  }
  if (input.bonus !== undefined) {
    data.bonus = input.bonus?.trim() || null;
  }

  return data;
}
