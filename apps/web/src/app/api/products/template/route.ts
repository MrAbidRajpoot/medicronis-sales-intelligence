import { NextResponse } from "next/server";
import { generateProductImportTemplate } from "@/lib/product-import";

export const dynamic = "force-dynamic";

export async function GET() {
  const buffer = await generateProductImportTemplate();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="medicronis-product-import-template.xlsx"',
    },
  });
}
