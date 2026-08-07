import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTemplateCoverageReport } from "@/lib/template-coverage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = await getTemplateCoverageReport(prisma);
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load template coverage";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
