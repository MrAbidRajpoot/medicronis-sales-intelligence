import { PrismaClient, PdfHeaderStructure } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PDF_FORMAT_PRESETS } from "./pdf-format-presets";
import { JULY_CLOSING_DISTRIBUTORS } from "./july-closing-distributors";
import { SEED_PRODUCTS } from "./data/products";
import { SEED_GEO } from "./data/geo";
import { SEED_PRODUCT_TARGETS } from "./data/product-targets";
import type { TemplateConfig } from "../apps/web/src/lib/pdf-template-types";

const prisma = new PrismaClient();

const DISTRIBUTORS = JULY_CLOSING_DISTRIBUTORS;

function toPrismaHeaderStructure(value: string): PdfHeaderStructure {
  return value as PdfHeaderStructure;
}

async function seedPdfFormats(): Promise<Map<string, string>> {
  const formatMap = new Map<string, string>();

  for (const preset of PDF_FORMAT_PRESETS) {
    const row = await prisma.pdfFormat.upsert({
      where: { code: preset.code },
      update: {
        name: preset.name,
        family: preset.family,
        headerStructure: toPrismaHeaderStructure(preset.headerStructure),
        defaultConfig: preset.defaultConfig,
        isActive: preset.isActive ?? true,
      },
      create: {
        code: preset.code,
        name: preset.name,
        family: preset.family,
        headerStructure: toPrismaHeaderStructure(preset.headerStructure),
        defaultConfig: preset.defaultConfig,
        isActive: preset.isActive ?? true,
      },
    });
    formatMap.set(preset.code, row.id);
  }

  return formatMap;
}

async function upsertManager(
  name: string,
  cache: Map<string, string>
): Promise<string> {
  const trimmed = name.trim() || "Vacant";
  const cached = cache.get(trimmed);
  if (cached) return cached;
  const row = await prisma.manager.upsert({
    where: { name: trimmed },
    update: { isActive: true },
    create: { name: trimmed },
  });
  cache.set(trimmed, row.id);
  return row.id;
}

async function upsertGeoEntity(
  model: "territory" | "area" | "region" | "zone",
  name: string,
  managerId: string,
  cache: Map<string, string>
): Promise<string> {
  const trimmed = name.trim();
  const cached = cache.get(trimmed);
  if (cached) {
    await prisma[model].update({
      where: { id: cached },
      data: { managerId, isActive: true },
    });
    return cached;
  }
  const row = await prisma[model].upsert({
    where: { name: trimmed },
    update: { managerId, isActive: true },
    create: { name: trimmed, managerId },
  });
  cache.set(trimmed, row.id);
  return row.id;
}

async function main() {
  console.log("Seeding Medicronis master data...");

  const formatMap = await seedPdfFormats();
  console.log(`  PdfFormats: ${PDF_FORMAT_PRESETS.length}`);

  const passwordHash = await bcrypt.hash("demo", 10);
  const admin = await prisma.user.upsert({
    where: { username: "demo" },
    update: {},
    create: {
      username: "demo",
      passwordHash,
      name: "Demo Admin",
    },
  });
  console.log(`  User: ${admin.username}`);

  const managerMap = new Map<string, string>();
  for (const name of SEED_GEO.managers) {
    await upsertManager(name, managerMap);
  }
  const vacantId = await upsertManager("Vacant", managerMap);
  console.log(`  Managers: ${managerMap.size}`);

  const territoryCache = new Map<string, string>();
  const areaCache = new Map<string, string>();
  const regionCache = new Map<string, string>();
  const zoneCache = new Map<string, string>();

  for (const t of SEED_GEO.territories) {
    const managerId = managerMap.get(t.manager) ?? vacantId;
    await upsertGeoEntity("territory", t.name, managerId, territoryCache);
  }
  for (const a of SEED_GEO.areas) {
    const managerId = managerMap.get(a.manager) ?? vacantId;
    await upsertGeoEntity("area", a.name, managerId, areaCache);
  }
  for (const r of SEED_GEO.regions) {
    const managerId = managerMap.get(r.manager) ?? vacantId;
    await upsertGeoEntity("region", r.name, managerId, regionCache);
  }
  for (const z of SEED_GEO.zones) {
    const managerId = managerMap.get(z.manager) ?? vacantId;
    await upsertGeoEntity("zone", z.name, managerId, zoneCache);
  }
  console.log(
    `  Geo: ${territoryCache.size} territories, ${areaCache.size} areas, ${regionCache.size} regions, ${zoneCache.size} zones`
  );

  // Ensure July Closing distributor geo names exist (Vacant if not in target sheets)
  async function ensureDistributorGeo(
    model: "territory" | "area" | "region" | "zone",
    name: string | null | undefined,
    cache: Map<string, string>
  ): Promise<string | null> {
    if (!name?.trim()) return null;
    const trimmed = name.trim();
    if (cache.has(trimmed)) return cache.get(trimmed)!;
    return upsertGeoEntity(model, trimmed, vacantId, cache);
  }

  const distributorMap = new Map<string, string>();
  for (const d of DISTRIBUTORS) {
    const pdfFormatId = formatMap.get(d.formatCode)!;
    const preset = PDF_FORMAT_PRESETS.find((p) => p.code === d.formatCode)!;
    const templateConfig = (d.templateConfig ?? preset.defaultConfig) as TemplateConfig;

    const territoryId = await ensureDistributorGeo("territory", d.territory, territoryCache);
    const areaId = await ensureDistributorGeo("area", d.area ?? null, areaCache);
    const regionId = await ensureDistributorGeo("region", d.region, regionCache);
    const zoneId = await ensureDistributorGeo("zone", d.zone, zoneCache);

    const dist = await prisma.distributor.upsert({
      where: { code: d.code },
      update: {
        name: d.name,
        territoryId,
        areaId,
        regionId,
        zoneId,
        pdfFormatId,
        inputMode: "BOTH",
        isActive: true,
      },
      create: {
        code: d.code,
        name: d.name,
        territoryId,
        areaId,
        regionId,
        zoneId,
        pdfFormatId,
        inputMode: "BOTH",
      },
    });
    distributorMap.set(d.code, dist.id);

    const existingTemplate = await prisma.distributorTemplate.findFirst({
      where: { distributorId: dist.id, isActive: true },
      orderBy: { version: "desc" },
    });

    if (existingTemplate) {
      await prisma.distributorTemplate.update({
        where: { id: existingTemplate.id },
        data: {
          name: `${preset.name} — ${d.name}`,
          description: `Format family ${preset.family} config for ${d.name}`,
          config: templateConfig,
          isActive: true,
          configuredAt: existingTemplate.configuredAt ?? new Date(),
        },
      });
    } else {
      await prisma.distributorTemplate.create({
        data: {
          distributorId: dist.id,
          name: `${preset.name} — ${d.name}`,
          description: `Format family ${preset.family} config for ${d.name}`,
          version: 1,
          isActive: true,
          config: templateConfig,
          configuredAt: new Date(),
        },
      });
    }
  }
  console.log(`  Distributors: ${DISTRIBUTORS.length} (July Closing PDFs)`);

  const manufacturerNames = [
    ...new Set(
      SEED_PRODUCTS.map((p) => p.manufacturer).filter((n): n is string => Boolean(n))
    ),
  ];
  const manufacturerMap = new Map<string, string>();
  for (const name of manufacturerNames) {
    const manufacturer = await prisma.manufacturer.upsert({
      where: { name },
      update: { isActive: true },
      create: { name },
    });
    manufacturerMap.set(name, manufacturer.id);
  }
  console.log(`  Manufacturers: ${manufacturerMap.size}`);

  const productGroupNames = [
    ...new Set(SEED_PRODUCTS.map((p) => p.group)),
    "Medicronis",
    "Transformer",
  ];
  const productGroupMap = new Map<string, string>();
  for (const name of productGroupNames) {
    const group = await prisma.productGroup.upsert({
      where: { name },
      update: { isActive: true },
      create: { name },
    });
    productGroupMap.set(name, group.id);
  }
  console.log(`  ProductGroups: ${[...productGroupMap.keys()].join(", ")}`);

  const seededSkus = new Set<string>();
  const productMap = new Map<string, string>();
  for (const p of SEED_PRODUCTS) {
    seededSkus.add(p.sku);
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        category: p.category,
        composition: p.composition,
        manufacturerId: p.manufacturer ? manufacturerMap.get(p.manufacturer) : null,
        productGroupId: productGroupMap.get(p.group)!,
        shipperSize: p.shipperSize,
        mrp: p.mrp,
        tp: p.tp,
        oldSp: p.oldSp,
        newSp: p.newSp,
        netPrice: p.netPrice,
        tax: p.tax,
        netPriceWith1Pct: p.netPriceWith1Pct,
        bonus: p.bonus,
        isActive: true,
      },
      create: {
        sku: p.sku,
        name: p.name,
        category: p.category,
        composition: p.composition,
        manufacturerId: p.manufacturer ? manufacturerMap.get(p.manufacturer) : null,
        productGroupId: productGroupMap.get(p.group)!,
        shipperSize: p.shipperSize,
        mrp: p.mrp,
        tp: p.tp,
        oldSp: p.oldSp,
        newSp: p.newSp,
        netPrice: p.netPrice,
        tax: p.tax,
        netPriceWith1Pct: p.netPriceWith1Pct,
        bonus: p.bonus,
      },
    });
    productMap.set(p.sku, product.id);

    for (const alias of p.aliases) {
      await prisma.productAlias.upsert({
        where: { productId_alias: { productId: product.id, alias } },
        update: {},
        create: { productId: product.id, alias },
      });
    }
  }
  console.log(`  Products: ${SEED_PRODUCTS.length}`);

  // Deactivate leftover demo SKUs not in the final product list
  const deactivated = await prisma.product.updateMany({
    where: { sku: { notIn: [...seededSkus] }, isActive: true },
    data: { isActive: false },
  });
  if (deactivated.count > 0) {
    console.log(`  Deactivated legacy products: ${deactivated.count}`);
  }

  let targetUpserts = 0;
  let targetSkipped = 0;
  const BATCH = 200;
  for (let i = 0; i < SEED_PRODUCT_TARGETS.length; i += BATCH) {
    const chunk = SEED_PRODUCT_TARGETS.slice(i, i + BATCH);
    await Promise.all(
      chunk.map(async (t) => {
        const productId = productMap.get(t.sku);
        const territoryId = territoryCache.get(t.territory);
        const areaId = areaCache.get(t.area);
        const regionId = regionCache.get(t.region);
        const zoneId = zoneCache.get(t.zone);
        const managerId = managerMap.get(t.manager) ?? vacantId;
        if (!productId || !territoryId || !areaId || !regionId || !zoneId) {
          targetSkipped++;
          return;
        }
        await prisma.productTarget.upsert({
          where: {
            productId_year_month_territoryId_areaId_regionId_zoneId: {
              productId,
              year: t.year,
              month: t.month,
              territoryId,
              areaId,
              regionId,
              zoneId,
            },
          },
          update: {
            managerId,
            quantity: t.quantity,
            isActive: true,
          },
          create: {
            productId,
            year: t.year,
            month: t.month,
            territoryId,
            areaId,
            regionId,
            zoneId,
            managerId,
            quantity: t.quantity,
          },
        });
        targetUpserts++;
      })
    );
    if ((i / BATCH) % 10 === 0) {
      console.log(`  ProductTargets progress: ${Math.min(i + BATCH, SEED_PRODUCT_TARGETS.length)}/${SEED_PRODUCT_TARGETS.length}`);
    }
  }
  console.log(`  ProductTargets: ${targetUpserts} upserted${targetSkipped ? `, ${targetSkipped} skipped` : ""}`);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
