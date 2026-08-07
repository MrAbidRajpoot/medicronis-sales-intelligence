import { NextResponse } from "next/server";
import { generateDistributorImportTemplate } from "@/lib/distributor-import";

export const dynamic = "force-dynamic";

export async function GET() {
  const buffer = await generateDistributorImportTemplate();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="medicronis-distributor-import-template.xlsx"',
    },
  });
}
