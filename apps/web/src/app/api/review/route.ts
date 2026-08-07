import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchRows } from "@/lib/pdf-worker";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.extractedRow.findMany({
    where: { status: { in: ["UNMATCHED", "PENDING"] } },
    include: {
      product: true,
      extractionRun: {
        include: {
          document: { include: { distributor: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const [products, aliases] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true } }),
    prisma.productAlias.findMany(),
  ]);

  const items = await Promise.all(
    rows.map(async (row) => {
      const doc = row.extractionRun.document;
      const distId = row.distributorId ?? doc.distributorId;

      let suggestedProductId: string | null = null;
      let suggestedSku: string | null = null;
      let suggestedName: string | null = null;
      let confidence = 0;
      let mappingStatus: "review" | "unknown" = "unknown";

      if (distId) {
        const mappings = await prisma.distributorProductMapping.findMany({
          where: { distributorId: distId },
        });

        const matchResult = await matchRows({
          rows: [
            {
              raw_product_text: row.rawProductText,
              quantity: Number(row.quantity),
              unit_price: row.unitPrice ? Number(row.unitPrice) : null,
              gross_value: row.lineTotal ? Number(row.lineTotal) : null,
            },
          ],
          distributor_id: distId,
          mappings: mappings.map((m) => ({
            raw_product_text: m.rawProductText,
            product_id: m.productId,
            confidence: m.confidence,
          })),
          products: products.map((p) => ({ id: p.id, sku: p.sku, name: p.name })),
          aliases: aliases.map((a) => ({ alias: a.alias, product_id: a.productId })),
        });

        const matched = matchResult.rows[0];
        if (matched) {
          mappingStatus =
            matched.match_status === "review" || matched.match_status === "unknown"
              ? matched.match_status === "review"
                ? "review"
                : "unknown"
              : "review";
          if (matched.suggested_product_id) {
            suggestedProductId = matched.suggested_product_id;
            suggestedSku = matched.suggested_product_sku ?? null;
            suggestedName = matched.suggested_product_name ?? null;
            confidence = matched.confidence;
            if (matched.match_status === "matched") mappingStatus = "review";
          }
        }
      }

      return {
        id: row.id,
        documentId: doc.id,
        documentName: doc.fileName,
        distributorName: doc.distributor?.name ?? "Unknown",
        distributorId: distId,
        rawProductText: row.rawProductText,
        quantity: Number(row.quantity),
        mappingStatus,
        suggestedProductId,
        suggestedSku,
        suggestedName,
        confidence,
      };
    })
  );

  const filtered = items.filter((i) => i.mappingStatus === "review" || i.mappingStatus === "unknown");

  return NextResponse.json({
    items: filtered,
    count: filtered.length,
  });
}
