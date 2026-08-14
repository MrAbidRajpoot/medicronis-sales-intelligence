import { NextResponse } from "next/server";
import { generateProductImportTemplate } from "@/lib/product-import";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const productGroupNames = (
    await prisma.productGroup.findMany({
      where: { isActive: true },
      select: { name: true },
      orderBy: { name: "asc" },
    })
  ).map((group) => group.name);
  const buffer = await generateProductImportTemplate(productGroupNames);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="medicronis-product-import-template.xlsx"',
    },
  });
}
