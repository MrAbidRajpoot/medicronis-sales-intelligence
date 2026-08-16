import { PrismaClient, PdfHeaderStructure } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PDF_FORMAT_PRESETS } from "./pdf-format-presets";
import { JULY_CLOSING_DISTRIBUTORS } from "./july-closing-distributors";
import type { TemplateConfig } from "../apps/web/src/lib/pdf-template-types";

const prisma = new PrismaClient();

const DISTRIBUTORS = JULY_CLOSING_DISTRIBUTORS;

const MANAGERS = ["Ahmed Khan", "Sara Malik", "Usman Ali"];

const MANUFACTURERS = ["Getz Pharma", "Searle", "Highnoon", "GlaxoSmithKline", "Abbott"];

const PRODUCT_GROUPS = ["Medicronis", "Transformer"] as const;

const PRODUCTS = [
  { sku: "MED-001", name: "Amoxicillin 500mg Caps", category: "Antibiotic", composition: "Amoxicillin 500mg", manufacturer: "Getz Pharma", shipperSize: 100, mrp: 450, tp: 380, oldSp: 360, newSp: 350, netPrice: 340, tax: 34, netPriceWith1Pct: 343.4, bonus: "4+1" },
  { sku: "MED-002", name: "Paracetamol 500mg Tab", category: "Analgesic", composition: "Paracetamol 500mg", manufacturer: "Searle", shipperSize: 200, mrp: 120, tp: 95, oldSp: 90, newSp: 88, netPrice: 85, tax: 8.5, netPriceWith1Pct: 85.85, bonus: "10+2" },
  { sku: "MED-003", name: "Omeprazole 20mg Cap", category: "GI", composition: "Omeprazole 20mg", manufacturer: "Highnoon", shipperSize: 50, mrp: 280, tp: 230, oldSp: 220, newSp: 215, netPrice: 210, tax: 21, netPriceWith1Pct: 212.1, bonus: "4+1" },
  { sku: "MED-004", name: "Metformin 500mg Tab", category: "Diabetes", composition: "Metformin 500mg", manufacturer: "Getz Pharma", shipperSize: 100, mrp: 180, tp: 150, oldSp: 145, newSp: 140, netPrice: 135, tax: 13.5, netPriceWith1Pct: 136.35, bonus: "5+1" },
  { sku: "MED-005", name: "Atorvastatin 10mg Tab", category: "Cardiovascular", composition: "Atorvastatin 10mg", manufacturer: "GlaxoSmithKline", shipperSize: 30, mrp: 520, tp: 440, oldSp: 430, newSp: 420, netPrice: 410, tax: 41, netPriceWith1Pct: 414.1, bonus: "3+1" },
  { sku: "MED-006", name: "Amlodipine 5mg Tab", category: "Cardiovascular", composition: "Amlodipine 5mg", manufacturer: "Abbott", shipperSize: 30, mrp: 350, tp: 290, oldSp: 280, newSp: 275, netPrice: 270, tax: 27, netPriceWith1Pct: 272.7, bonus: "4+1" },
  { sku: "MED-007", name: "Losartan 50mg Tab", category: "Cardiovascular", composition: "Losartan 50mg", manufacturer: "Highnoon", shipperSize: 30, mrp: 400, tp: 330, oldSp: 320, newSp: 310, netPrice: 300, tax: 30, netPriceWith1Pct: 303, bonus: "4+1" },
  { sku: "MED-008", name: "Azithromycin 250mg Tab", category: "Antibiotic", composition: "Azithromycin 250mg", manufacturer: "Getz Pharma", shipperSize: 20, mrp: 680, tp: 560, oldSp: 550, newSp: 540, netPrice: 530, tax: 53, netPriceWith1Pct: 535.3, bonus: "2+1" },
  { sku: "MED-009", name: "Ciprofloxacin 500mg Tab", category: "Antibiotic", composition: "Ciprofloxacin 500mg", manufacturer: "Searle", shipperSize: 20, mrp: 420, tp: 350, oldSp: 340, newSp: 335, netPrice: 330, tax: 33, netPriceWith1Pct: 333.3, bonus: "4+1" },
  { sku: "MED-010", name: "Ibuprofen 400mg Tab", category: "Analgesic", composition: "Ibuprofen 400mg", manufacturer: "Abbott", shipperSize: 100, mrp: 160, tp: 130, oldSp: 125, newSp: 120, netPrice: 115, tax: 11.5, netPriceWith1Pct: 116.15, bonus: "10+2" },
  { sku: "MED-011", name: "Cetirizine 10mg Tab", category: "Allergy", composition: "Cetirizine 10mg", manufacturer: "GlaxoSmithKline", shipperSize: 100, mrp: 140, tp: 110, oldSp: 105, newSp: 100, netPrice: 95, tax: 9.5, netPriceWith1Pct: 95.95, bonus: "10+2" },
  { sku: "MED-012", name: "Pantoprazole 40mg Tab", category: "GI", composition: "Pantoprazole 40mg", manufacturer: "Highnoon", shipperSize: 30, mrp: 320, tp: 260, oldSp: 250, newSp: 245, netPrice: 240, tax: 24, netPriceWith1Pct: 242.4, bonus: "4+1" },
  { sku: "MED-013", name: "Glimepiride 2mg Tab", category: "Diabetes", composition: "Glimepiride 2mg", manufacturer: "Getz Pharma", shipperSize: 30, mrp: 220, tp: 180, oldSp: 175, newSp: 170, netPrice: 165, tax: 16.5, netPriceWith1Pct: 166.65, bonus: "5+1" },
  { sku: "MED-014", name: "Insulin Glargine 100IU", category: "Diabetes", composition: "Insulin Glargine 100IU", manufacturer: "Abbott", shipperSize: 1, mrp: 4500, tp: 3800, oldSp: 3700, newSp: 3650, netPrice: 3600, tax: 360, netPriceWith1Pct: 3636 },
  { sku: "MED-015", name: "Salbutamol Inhaler 100mcg", category: "Respiratory", composition: "Salbutamol 100mcg", manufacturer: "GlaxoSmithKline", shipperSize: 1, mrp: 580, tp: 480, oldSp: 470, newSp: 460, netPrice: 450, tax: 45, netPriceWith1Pct: 454.5 },
  { sku: "MED-016", name: "Montelukast 10mg Tab", category: "Respiratory", composition: "Montelukast 10mg", manufacturer: "Searle", shipperSize: 30, mrp: 380, tp: 310, oldSp: 300, newSp: 295, netPrice: 290, tax: 29, netPriceWith1Pct: 292.9, bonus: "4+1" },
  { sku: "MED-017", name: "Vitamin D3 50000IU", category: "Supplement", composition: "Cholecalciferol 50000IU", manufacturer: "Highnoon", shipperSize: 4, mrp: 240, tp: 190, oldSp: 185, newSp: 180, netPrice: 175, tax: 17.5, netPriceWith1Pct: 176.75, bonus: "3+1" },
  { sku: "MED-018", name: "Calcium + Vit D Tab", category: "Supplement", composition: "Calcium Carbonate + Vit D", manufacturer: "Getz Pharma", shipperSize: 30, mrp: 260, tp: 210, oldSp: 205, newSp: 200, netPrice: 195, tax: 19.5, netPriceWith1Pct: 196.95, bonus: "5+1" },
  { sku: "MED-019", name: "Ferrous Sulfate 200mg", category: "Supplement", composition: "Ferrous Sulfate 200mg", manufacturer: "Abbott", shipperSize: 30, mrp: 150, tp: 120, oldSp: 115, newSp: 110, netPrice: 105, tax: 10.5, netPriceWith1Pct: 106.05, bonus: "10+2" },
  { sku: "MED-020", name: "Multivitamin Tab", category: "Supplement", composition: "Multivitamin", manufacturer: "Searle", shipperSize: 30, mrp: 200, tp: 160, oldSp: 155, newSp: 150, netPrice: 145, tax: 14.5, netPriceWith1Pct: 146.45, bonus: "10+2" },
];

const ALIASES: Record<string, string[]> = {
  "MED-001": ["Amox 500", "Amoxicillin Cap", "AMOXICILLIN 500MG"],
  "MED-002": ["PCM 500", "Panadol Generic", "PARACETAMOL TAB"],
  "MED-003": ["Omep 20", "OMEPRAZOLE CAP"],
  "MED-004": ["Met 500", "METFORMIN TAB"],
  "MED-005": ["Atorva 10", "ATORVASTATIN 10"],
  "MED-006": ["Amlod 5", "AMLODIPINE TAB"],
  "MED-007": ["Los 50", "LOSARTAN TAB"],
  "MED-008": ["Azithro 250", "AZITHROMYCIN TAB"],
  "MED-009": ["Cipro 500", "CIPROFLOXACIN TAB"],
  "MED-010": ["Ibu 400", "IBUPROFEN TAB"],
  "MED-011": ["Cet 10", "CETIRIZINE TAB"],
  "MED-012": ["Panto 40", "PANTOPRAZOLE TAB"],
  "MED-013": ["Glim 2", "GLIMEPIRIDE TAB"],
  "MED-014": ["Insulin Lantus", "GLARGINE 100IU"],
  "MED-015": ["Salb Inhaler", "SALBUTAMOL INH"],
  "MED-016": ["Monte 10", "MONTELUKAST TAB"],
  "MED-017": ["Vit D3 50K", "VITAMIN D3"],
  "MED-018": ["Cal+D Tab", "CALCIUM VIT D"],
  "MED-019": ["Fe Sulfate", "FERROUS SULFATE"],
  "MED-020": ["Multi Vit", "MULTIVITAMIN"],
};

const DISTRIBUTOR_MAPPINGS = [
  { distCode: "AIM-HYD", rawText: "AMOXICILLIN 500MG CAPS", sku: "MED-001" },
  { distCode: "AIM-HYD", rawText: "PARACETAMOL TAB 500", sku: "MED-002" },
  { distCode: "AL-SHIFA-JAMPUR", rawText: "Omeprazole 20mg", sku: "MED-003" },
  { distCode: "AL-REHMAN-LHR", rawText: "Metformin HCl 500", sku: "MED-004" },
  { distCode: "AQ-SARGODHA", rawText: "Atorvastatin-10", sku: "MED-005" },
  { distCode: "BASHIR-GUJ", rawText: "Azithro 250mg", sku: "MED-008" },
];

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

async function main() {
  console.log("Seeding Medicronis demo data...");

  const formatMap = await seedPdfFormats();
  console.log(`  PdfFormats: ${PDF_FORMAT_PRESETS.length} (families A–J)`);

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

  const MANAGER_NAMES = ["Vacant", ...MANAGERS];
  const managerMap = new Map<string, string>();
  for (const name of MANAGER_NAMES) {
    const manager = await prisma.manager.upsert({
      where: { name },
      update: { isActive: true },
      create: { name },
    });
    managerMap.set(name, manager.id);
  }
  console.log(`  Managers: ${MANAGER_NAMES.length}`);

  const vacantId = managerMap.get("Vacant")!;
  let geoManagerIdx = 0;

  async function upsertGeo(
    model: "territory" | "area" | "region" | "zone",
    name: string | null | undefined,
    cache: Map<string, string>
  ): Promise<string | null> {
    if (!name?.trim()) return null;
    const trimmed = name.trim();
    const cached = cache.get(trimmed);
    if (cached) return cached;

    const managerId =
      managerMap.get(MANAGERS[geoManagerIdx % MANAGERS.length]) ?? vacantId;
    geoManagerIdx++;

    const row = await prisma[model].upsert({
      where: { name: trimmed },
      update: {},
      create: { name: trimmed, managerId },
    });
    cache.set(trimmed, row.id);
    return row.id;
  }

  const territoryCache = new Map<string, string>();
  const areaCache = new Map<string, string>();
  const regionCache = new Map<string, string>();
  const zoneCache = new Map<string, string>();

  const distributorMap = new Map<string, string>();
  for (let i = 0; i < DISTRIBUTORS.length; i++) {
    const d = DISTRIBUTORS[i];
    const pdfFormatId = formatMap.get(d.formatCode)!;
    const preset = PDF_FORMAT_PRESETS.find((p) => p.code === d.formatCode)!;
    const templateConfig = (d.templateConfig ?? preset.defaultConfig) as TemplateConfig;
    // Default BOTH (PDF + Excel; Excel optional). EXCEL_ONLY is manual-only — not seeded.
    const inputMode = "BOTH" as const;

    const territoryId = await upsertGeo("territory", d.territory, territoryCache);
    const areaId = await upsertGeo("area", d.area, areaCache);
    const regionId = await upsertGeo("region", d.region, regionCache);
    const zoneId = await upsertGeo("zone", d.zone, zoneCache);

    const dist = await prisma.distributor.upsert({
      where: { code: d.code },
      update: {
        name: d.name,
        territoryId,
        areaId,
        regionId,
        zoneId,
        pdfFormatId,
        inputMode,
      },
      create: {
        code: d.code,
        name: d.name,
        territoryId,
        areaId,
        regionId,
        zoneId,
        pdfFormatId,
        inputMode,
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
  console.log(`  Distributors: ${DISTRIBUTORS.length} (July Closing set, all with pdfFormat + template)`);
  console.log(`  inputMode: BOTH for all seeded distributors (EXCEL_ONLY is manual-only)`);

  const manufacturerMap = new Map<string, string>();
  for (const name of MANUFACTURERS) {
    const manufacturer = await prisma.manufacturer.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    manufacturerMap.set(name, manufacturer.id);
  }
  console.log(`  Manufacturers: ${MANUFACTURERS.length}`);

  const productGroupMap = new Map<string, string>();
  for (const name of PRODUCT_GROUPS) {
    const group = await prisma.productGroup.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    productGroupMap.set(name, group.id);
  }
  console.log(`  ProductGroups: ${PRODUCT_GROUPS.length}`);

  const defaultProductGroupId = productGroupMap.get("Medicronis")!;

  const productMap = new Map<string, string>();
  for (const p of PRODUCTS) {
    const { manufacturer, ...productData } = p;
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        productGroupId: defaultProductGroupId,
      },
      create: {
        ...productData,
        manufacturerId: manufacturerMap.get(manufacturer),
        productGroupId: defaultProductGroupId,
      },
    });
    productMap.set(p.sku, product.id);

    for (const alias of ALIASES[p.sku] ?? []) {
      await prisma.productAlias.upsert({
        where: { productId_alias: { productId: product.id, alias } },
        update: {},
        create: { productId: product.id, alias },
      });
    }
  }
  console.log(`  Products: ${PRODUCTS.length} (with aliases)`);

  for (const m of DISTRIBUTOR_MAPPINGS) {
    const distributorId = distributorMap.get(m.distCode)!;
    const productId = productMap.get(m.sku)!;
    await prisma.distributorProductMapping.upsert({
      where: {
        distributorId_rawProductText: {
          distributorId,
          rawProductText: m.rawText,
        },
      },
      update: {},
      create: {
        distributorId,
        rawProductText: m.rawText,
        productId,
        confidence: 1.0,
        isVerified: true,
      },
    });
  }
  console.log(`  Distributor product mappings: ${DISTRIBUTOR_MAPPINGS.length}`);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
