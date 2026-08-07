import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { TemplateConfig } from "@/lib/pdf-template-types";

export const dynamic = "force-dynamic";

export async function GET() {
  const formats = await prisma.pdfFormat.findMany({
    where: { isActive: true },
    orderBy: [{ family: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      family: true,
      headerStructure: true,
      defaultConfig: true,
    },
  });

  return NextResponse.json(
    formats.map((format) => ({
      id: format.id,
      code: format.code,
      name: format.name,
      family: format.family,
      headerStructure: format.headerStructure,
      defaultConfig: format.defaultConfig as unknown as TemplateConfig,
    }))
  );
}
