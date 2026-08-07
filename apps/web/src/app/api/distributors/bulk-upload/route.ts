import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveManagerId } from "@/lib/distributor-helpers";
import { parseDistributorImportFile } from "@/lib/distributor-import";

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
    const { rows, errors: parseErrors } = await parseDistributorImportFile(buffer);

    if (rows.length === 0 && parseErrors.length > 0) {
      return NextResponse.json(
        { error: "No valid rows found", errors: parseErrors },
        { status: 400 }
      );
    }

    const existingCodes = new Set(
      (
        await prisma.distributor.findMany({
          where: { code: { in: rows.map((r) => r.code) } },
          select: { code: true },
        })
      ).map((d) => d.code)
    );

    const defaultFormat = await prisma.pdfFormat.findFirst({
      where: { code: "fmt-a-ssr-stock-return", isActive: true },
    });
    if (!defaultFormat) {
      return NextResponse.json(
        { error: "Default PDF format (family A) not seeded — run db:seed" },
        { status: 500 }
      );
    }

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [...parseErrors];

    for (const row of rows) {
      if (existingCodes.has(row.code)) {
        skipped++;
        errors.push({
          rowNumber: row.rowNumber,
          code: row.code,
          message: "Distributor code already exists",
        });
        continue;
      }

      try {
        const managerId = await resolveManagerId(null, row.managerName);

        await prisma.distributor.create({
          data: {
            code: row.code,
            name: row.name,
            region: row.region,
            country: row.country,
            city: row.city,
            pdfFormatId: defaultFormat.id,
            ...(managerId !== undefined && managerId !== null && { managerId }),
            templates: {
              create: {
                name: `${defaultFormat.name} — ${row.name}`,
                description: `Format family ${defaultFormat.family} default config (bulk import)`,
                version: 1,
                isActive: true,
                configuredAt: new Date(),
                config: defaultFormat.defaultConfig as Prisma.InputJsonValue,
              },
            },
          },
        });

        existingCodes.add(row.code);
        created++;
      } catch (err) {
        failed++;
        errors.push({
          rowNumber: row.rowNumber,
          code: row.code,
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
