import type { PdfFormatPreset, TemplateConfig } from "../apps/web/src/lib/pdf-template-types";

const SSR_SKIP = ["total", "group:", "grand total", "page"];

export const PDFPLUMBER_ALT_SETTINGS: import("./pdf-template-types").PdfPlumberSettings = {
  vertical_strategy: "text",
  horizontal_strategy: "text",
  snap_tolerance: 5,
  join_tolerance: 5,
};

/**
 * Family A — SSR Stock & Return (ITEM / RATE / NET SALE).
 * 17-col default; 16-col variant via distributor templateConfig override (Al Haram Kohat).
 * Column indices are fallbacks — label-path group/leaf resolution preferred.
 */
export const FAMILY_A_DEFAULT: TemplateConfig = {
  headerStructure: "grouped_two_row",
  skipRowsContaining: SSR_SKIP,
  detection: {
    titlePatterns: ["SALES, STOCK & RETURN", "SALES STOCK & RETURN", "SALES, STOCK AND RETURN"],
    headerKeywords: ["ITEM", "RATE", "NET SALE"],
  },
  fields: {
    product_name: { col: 0, group: "ITEM" },
    unit_price: { col: 1, group: "RATE" },
    returns_qty: { col: 10, group: "RETURN", leaf: "QTY" },
    sales_qty: { col: 12, group: "NET SALE", leaf: "QTY" },
    sales_amount: { col: 14, group: "NET SALE", leaf: "AMOUNT" },
    closing_stock: { col: 15, group: "CLOSING", leaf: "QTY" },
  },
};

/** Family A — 16-column variant (Al Haram Kohat). */
export const FAMILY_A_16COL: TemplateConfig = {
  ...FAMILY_A_DEFAULT,
  fields: {
    product_name: { col: 0, group: "ITEM" },
    unit_price: { col: 1, group: "RATE" },
    returns_qty: { col: 9, group: "RETURN", leaf: "QTY" },
    sales_qty: { col: 11, group: "NET SALE", leaf: "QTY" },
    sales_amount: { col: 13, group: "NET SALE", leaf: "AMOUNT" },
    closing_stock: { col: 14, group: "CLOSING", leaf: "QTY" },
  },
};

/**
 * Family B — Medicronis ERP Sales and Stock Statement.
 * Title block then 16-col product table (ID / DESCRIPTION / TP / NET SALE).
 */
export const FAMILY_B_DEFAULT: TemplateConfig = {
  headerStructure: "title_block_then_table",
  skipRowsBeforeHeader: 2,
  skipRowsContaining: [
    "total",
    "group:",
    "grand total",
    "page",
    "developed by",
    "softronix",
    "net opening value",
    "net purchase value",
    "net sale value",
    "from date:",
    "printing date:",
  ],
  detection: {
    titlePatterns: ["SALES AND STOCK STATEMENT", "SALE & STOCK STATMENT"],
    headerKeywords: ["DESCRIPTION", "NET SALE"],
  },
  fields: {
    product_name: { col: 1, group: "DESCRIPTION" },
    unit_price: { col: 2, group: "TP" },
    returns_qty: { col: 9, group: "S.RET", leaf: "QTY" },
    sales_qty: { col: 10, group: "NET SALE", leaf: "QTY" },
    sales_amount: { col: 12, group: "NET SALE", leaf: "VALUE" },
    closing_stock: { col: 14, group: "CLOSING", leaf: "QTY" },
  },
};

/**
 * Family C — Item Description / Opening / PURCHASE / SALE (13 / 14 / 15 col).
 * Same preset; label-path resolves Net Sales + Value under SALE group.
 */
export const FAMILY_C_DEFAULT: TemplateConfig = {
  headerStructure: "grouped_two_row",
  skipRowsContaining: ["total", "group:", "grand total", "page", "sub total", "subtotal"],
  detection: {
    headerKeywords: ["ITEM DESCRIPTION", "OPENING BALANCE", "NET SALES"],
  },
  fields: {
    product_name: { col: 0, group: "Item Description" },
    unit_price: { col: 1, group: "Rate" },
    returns_qty: { col: 5, group: "PURCHASE", leaf: "Return" },
    sales_qty: { col: 7, group: "SALE", leaf: "Net Sales" },
    sales_amount: { col: 9, group: "SALE", leaf: "Value" },
    closing_stock: { col: 11, group: "CLOSING", leaf: "Balance" },
  },
};

/**
 * Family D — Product Name T.P. Tax / Opening / Purchase / B.C / Sale (19-col).
 */
export const FAMILY_D_DEFAULT: TemplateConfig = {
  headerStructure: "grouped_two_row",
  skipRowsContaining: SSR_SKIP,
  pdfPlumberSettings: PDFPLUMBER_ALT_SETTINGS,
  detection: {
    headerKeywords: ["PRODUCT NAME", "T.P.", "NET SALE", "SALE RETURN"],
  },
  fields: {
    product_name: { col: 0, group: "Product Name T.P. Tax" },
    unit_price: { col: 0, group: "Product Name T.P. Tax" },
    returns_qty: { col: 9, group: "Sale Return", leaf: "Qty." },
    sales_qty: { col: 11, group: "Net Sale", leaf: "Qty." },
    sales_amount: { col: 13, group: "Net Sale", leaf: "Value" },
    closing_stock: { col: 15, group: "Closing Balance", leaf: "Qty." },
  },
};

/**
 * Family E — TRAD RATE / OPENING / RECEIPT / NET SALE (13-col).
 * Hamed Bannu (TRAD RATE) and Mehran Mardan (DESCRIPTION / TRADE RATE).
 */
export const FAMILY_E_DEFAULT: TemplateConfig = {
  headerStructure: "grouped_two_row",
  skipRowsContaining: SSR_SKIP,
  detection: {
    headerKeywords: ["TRAD RATE", "NET SALE", "OPENING BALANCE"],
  },
  fields: {
    product_name: { col: 0, group: "DESCRIPTION" },
    unit_price: { col: 1, group: "TRAD RATE" },
    returns_qty: { col: 6, group: "SALE", leaf: "RETURN" },
    sales_qty: { col: 7, group: "SALE", leaf: "NET SALE" },
    sales_amount: { col: 8, group: "SALE", leaf: "AMOUNT" },
  },
};

/** Family F — Simple single-row: Description / Sales Qty / Sale Value (10-col). */
export const FAMILY_F_DEFAULT: TemplateConfig = {
  headerStructure: "single_row",
  skipRowsContaining: SSR_SKIP,
  detection: {
    headerKeywords: ["DESCRIPTION / PACK", "SALES QTY", "SALE VALUE"],
  },
  fields: {
    product_name: { col: 0, group: "Description / Pack" },
    unit_price: { col: 1, group: "T.P." },
    sales_qty: { col: 4, group: "Sales Qty" },
    sales_amount: { col: 5, group: "Sale Value" },
    closing_stock: { col: 8, group: "Closing Stock" },
  },
};

/**
 * Family G — Code / Product / TP / Opening / Purchase / Net Sale.
 * Chishti Multan (16-col single header) and Zavion Jhang (14-col two-row).
 */
export const FAMILY_G_DEFAULT: TemplateConfig = {
  headerStructure: "grouped_two_row",
  skipRowsContaining: SSR_SKIP,
  detection: {
    headerKeywords: ["PRODUCT DESC", "PRODUCT", "NET SALE", "CODE"],
  },
  fields: {
    product_name: { col: 1, group: "Product Desc" },
    unit_price: { col: 3, group: "Rate" },
    returns_qty: { col: 8, group: "Ret Sale" },
    sales_qty: { col: 9, group: "Net Sale", leaf: "Qty" },
    sales_amount: { col: 10, group: "Sale Value", leaf: "Value" },
    closing_stock: { col: 14, group: "Clos Qty" },
  },
  lineParser: {
    enabled: true,
    mode: "rate_and_columns",
    codePrefix: true,
    salesQtyColumn: 5,
    salesAmountColumn: 6,
    minNumericColumns: 7,
    treatDashAsZero: true,
  },
};

/** Family H — NAME / PRICE / OPEN STOCK / RECEIPT / SALES (21-col). */
export const FAMILY_H_DEFAULT: TemplateConfig = {
  headerStructure: "grouped_two_row",
  skipRowsContaining: SSR_SKIP,
  detection: {
    headerKeywords: ["NAME", "PRICE", "OPEN STOCK", "NET SALE"],
  },
  fields: {
    product_name: { col: 1, group: "NAME" },
    unit_price: { col: 2, group: "PRICE" },
    sales_qty: { col: 11, group: "NET SALE" },
    sales_amount: { col: 13, group: "SALE VALUES" },
    closing_stock: { col: 15, group: "TRANSFER" },
  },
};

/** Family I — Vertical NET SALES QTY.BON AMOUNT headers (7-col). */
export const FAMILY_I_DEFAULT: TemplateConfig = {
  headerStructure: "grouped_two_row",
  skipRowsContaining: [...SSR_SKIP, "division / group", "net sold bonus", "grand total"],
  detection: {
    headerKeywords: ["NET SALES", "QTY.BON AMOUNT", "SALES RETURN"],
  },
  fields: {
    product_name: { col: 0 },
    returns_qty: { col: 4, group: "SALES RETURN", leaf: "QTY. BO" },
    sales_qty: { col: 5, group: "NET SALES", leaf: "QTY.BON AMOUNT" },
    sales_amount: { col: 5, group: "NET SALES", leaf: "QTY.BON AMOUNT" },
  },
  lineParser: {
    enabled: true,
    mode: "rate_and_columns",
    salesQtyColumn: 4,
    salesAmountColumn: 5,
    minNumericColumns: 6,
  },
};

/**
 * Family J — No detectable table / text-only PDFs.
 * Table extraction disabled; line parser used (Phase 5). OCR not enabled.
 */
export const FAMILY_J_DEFAULT: TemplateConfig = {
  headerStructure: "line_fallback",
  tableExtractionDisabled: true,
  skipRowsContaining: ["total", "page", "grand total"],
  detection: {
    titlePatterns: [
      "STOCK STATEMENT",
      "SALE & STOCK",
      "SALE AND STOCK",
      "SALES & STOCK REPORT",
    ],
    noTableIndicator: true,
  },
  lineParser: {
    enabled: true,
    mode: "rate_and_columns",
    salesQtyColumn: 4,
    salesAmountColumn: 5,
  },
  fields: {},
};

/** Bukhari Traders MBD — STOCK STATEMENT text lines. */
export const FAMILY_J_BUKHARI: TemplateConfig = {
  ...FAMILY_J_DEFAULT,
  lineParser: {
    enabled: true,
    mode: "rate_and_columns",
    salesQtyColumn: 4,
    salesAmountColumn: 5,
    minNumericColumns: 6,
  },
};

/** Ayan Pharma Taunsa — SALES & STOCK REPORT text layout. */
export const FAMILY_J_AYAN: TemplateConfig = {
  ...FAMILY_J_DEFAULT,
  lineParser: {
    enabled: true,
    mode: "rate_and_columns",
    salesQtyColumn: 2,
    salesAmountColumn: 3,
    minNumericColumns: 4,
  },
};

/** Ch Medicine MWL — integer-only trailing columns. */
export const FAMILY_J_CH_MEDICINE: TemplateConfig = {
  ...FAMILY_J_DEFAULT,
  lineParser: {
    enabled: true,
    mode: "trailing_integers",
    trailingNumericCount: 8,
    salesQtyColumn: 4,
    salesAmountColumn: 7,
  },
};

/** AMT FSD — collapsed 1-col table; alternate pdfplumber then line parser. */
export const FAMILY_J_AMT: TemplateConfig = {
  headerStructure: "grouped_two_row",
  tableExtractionDisabled: false,
  skipRowsContaining: ["total", "page", "grand total", "trade group", "medicronics pharma"],
  pdfPlumberSettings: PDFPLUMBER_ALT_SETTINGS,
  lineParser: {
    enabled: true,
    mode: "rate_and_columns",
    codePrefix: true,
    salesQtyColumn: 4,
    salesAmountColumn: 5,
    minNumericColumns: 5,
  },
  fields: {
    product_name: { col: 1, group: "Product" },
    sales_qty: { col: 10, group: "Net Sale", leaf: "Qty" },
    sales_amount: { col: 11, group: "Net Sale", leaf: "Value" },
  },
};

/** Hamza Medicine TTS — Family Z; alternate pdfplumber improves table parse. */
export const FAMILY_Z_HAMZA: TemplateConfig = {
  ...FAMILY_F_DEFAULT,
  pdfPlumberSettings: PDFPLUMBER_ALT_SETTINGS,
  lineParser: {
    enabled: true,
    mode: "rate_and_columns",
    treatDashAsZero: true,
    salesQtyColumn: 2,
    salesAmountColumn: 3,
    minNumericColumns: 4,
  },
};

/** Evergreen DI Khan — text-only TRAD RATE lines (mis-detected tables). */
export const FAMILY_Z_EVERGREEN: TemplateConfig = {
  ...FAMILY_E_DEFAULT,
  tableExtractionDisabled: true,
  headerStructure: "line_fallback",
  skipRowsContaining: [...SSR_SKIP, "sale & stock statment", "email:", "land line"],
  lineParser: {
    enabled: true,
    mode: "rate_and_columns",
    codePrefix: true,
    salesQtyColumn: 3,
    salesAmountColumn: 5,
    minNumericColumns: 6,
  },
};

/** Globar Enterprises SKP — spaced text layout. */
export const FAMILY_J_GLOBAL: TemplateConfig = {
  ...FAMILY_J_DEFAULT,
  lineParser: {
    enabled: true,
    mode: "rate_and_columns",
    salesQtyColumn: 1,
    salesAmountColumn: 5,
    minNumericColumns: 3,
  },
};

/** Life Care Gujrat — Sr# prefixed product lines. */
export const FAMILY_J_LIFE_CARE: TemplateConfig = {
  ...FAMILY_J_DEFAULT,
  skipRowsContaining: ["total", "page", "grand total", "medicine name", "sr #"],
  lineParser: {
    enabled: true,
    mode: "rate_and_columns",
    codePrefix: true,
    salesQtyColumn: 6,
    salesAmountColumn: 7,
    minNumericColumns: 8,
    treatDashAsZero: true,
  },
};

/** Zafar & Sons NWS — pipe-delimited text table. */
export const FAMILY_J_ZAFAR: TemplateConfig = {
  ...FAMILY_J_DEFAULT,
  skipRowsContaining: ["total", "page", "grand total", "company wise", "company name"],
  lineParser: {
    enabled: true,
    mode: "pipe_table",
    productColumn: 1,
    rateColumn: 3,
    salesQtyColumn: 9,
    salesAmountColumn: 11,
  },
};

/** Hashmani Karachi — product names in text, not table columns. */
export const FAMILY_I_HASHMANI: TemplateConfig = {
  ...FAMILY_I_DEFAULT,
  tableExtractionDisabled: true,
  headerStructure: "line_fallback",
  lineParser: {
    enabled: true,
    mode: "rate_and_columns",
    salesQtyColumn: 4,
    salesAmountColumn: 5,
    minNumericColumns: 6,
  },
};

/** Zavion Jhang — data in text lines, headers-only tables. */
export const FAMILY_G_ZAVION: TemplateConfig = {
  ...FAMILY_G_DEFAULT,
  tableExtractionDisabled: true,
  headerStructure: "line_fallback",
  lineParser: {
    enabled: true,
    mode: "rate_and_columns",
    codePrefix: true,
    salesQtyColumn: 5,
    salesAmountColumn: 6,
    minNumericColumns: 7,
    treatDashAsZero: true,
  },
};

/** Al Makkah Buner — spaced text lines with code prefix (table is header-only). */
export const FAMILY_D_AL_MAKKAH: TemplateConfig = {
  ...FAMILY_D_DEFAULT,
  tableExtractionDisabled: true,
  headerStructure: "line_fallback",
  skipRowsContaining: [...SSR_SKIP, "medicronis", "product name"],
  lineParser: {
    enabled: true,
    mode: "rate_and_columns",
    codePrefix: true,
    ratePattern: String.raw`\d+\.\d{2,5}`,
    salesQtyColumn: 11,
    salesAmountColumn: 12,
    minNumericColumns: 13,
    treatDashAsZero: true,
  },
};

export const PDF_FORMAT_PRESETS: PdfFormatPreset[] = [
  {
    code: "fmt-a-ssr-stock-return",
    name: "SSR Stock & Return (ITEM / RATE / NET SALE)",
    family: "A",
    headerStructure: "grouped_two_row",
    defaultConfig: FAMILY_A_DEFAULT,
  },
  {
    code: "fmt-b-medicronis-erp",
    name: "Medicronis ERP Sales and Stock Statement",
    family: "B",
    headerStructure: "title_block_then_table",
    defaultConfig: FAMILY_B_DEFAULT,
  },
  {
    code: "fmt-c-item-desc-net-sales",
    name: "Item Description / Opening / PURCHASE / SALE",
    family: "C",
    headerStructure: "grouped_two_row",
    defaultConfig: FAMILY_C_DEFAULT,
  },
  {
    code: "fmt-d-product-name-tp-tax",
    name: "Product Name T.P. Tax / Opening / Purchase / Sale",
    family: "D",
    headerStructure: "grouped_two_row",
    defaultConfig: FAMILY_D_DEFAULT,
  },
  {
    code: "fmt-e-trad-rate-net-sale",
    name: "TRAD RATE / OPENING / RECEIPT / NET SALE",
    family: "E",
    headerStructure: "grouped_two_row",
    defaultConfig: FAMILY_E_DEFAULT,
  },
  {
    code: "fmt-f-simple-sales",
    name: "Simple Description / Sales Qty / Sale Value",
    family: "F",
    headerStructure: "single_row",
    defaultConfig: FAMILY_F_DEFAULT,
  },
  {
    code: "fmt-g-code-product-net-sale",
    name: "Code / Product Desc / Net Sale",
    family: "G",
    headerStructure: "grouped_two_row",
    defaultConfig: FAMILY_G_DEFAULT,
  },
  {
    code: "fmt-h-name-price-sales",
    name: "NAME / PRICE / OPEN STOCK / SALES",
    family: "H",
    headerStructure: "grouped_two_row",
    defaultConfig: FAMILY_H_DEFAULT,
  },
  {
    code: "fmt-i-vertical-qty-bon",
    name: "Vertical NET SALES QTY.BON AMOUNT",
    family: "I",
    headerStructure: "grouped_two_row",
    defaultConfig: FAMILY_I_DEFAULT,
  },
  {
    code: "fmt-j-no-table",
    name: "No table / line parser fallback",
    family: "J",
    headerStructure: "line_fallback",
    defaultConfig: FAMILY_J_DEFAULT,
  },
];

/** Format code → July Closing PDF filenames (for docs / seed reference). */
export const JULY_CLOSING_FORMAT_MAP: Record<string, string[]> = {
  "fmt-a-ssr-stock-return": [
    "AIM Pharma HYD.pdf",
    "Lal Drug Agency Sibbi.pdf",
    "Reliable Pharma MPK.pdf",
    "Al Haram Enterprises Kohat.pdf",
  ],
  "fmt-b-medicronis-erp": [
    "AL Shifa Enterprises Jampur.pdf",
    "AQ Enterprises Sargodha.pdf",
    "Al Harmain ENterprises DG Khan.pdf",
    "N&G Enterprises SWL.pdf",
    "Wellcome Pharma alipur.pdf",
    "sHAHZAIB pHARMA Okara30.pdf",
    "Ruman Medicine Promotion RYK.pdf",
    "Ruman Medicine Trade RYK.pdf",
  ],
  "fmt-c-item-desc-net-sales": [
    "Al Rehman  Medical Sources Lahore.pdf",
    "Al Rehman Medical Sources Lahore.pdf",
    "Bashir Pharma Gujranwala.pdf",
    "M&C RWP.pdf",
    "Pharmarite Distributor Jehlum.pdf",
    "Shafiq Medicine Company Khanpur.pdf",
    "Haji Nizam & Sons Quetta.pdf",
  ],
  "fmt-d-product-name-tp-tax": [
    "Al Makkah Trading Buner.PDF",
    "Kamal Medicine Company Timergarah.PDF",
    "Medicamp PSW.PDF",
    "Umar Medicine Swabi.PDF",
  ],
  "fmt-e-trad-rate-net-sale": [
    "Hamed Pharma Bannu Promotion.pdf",
    "Hamed Pharma Bannu Trade.pdf",
    "Mehran Traders Mardan.pdf",
    "Evergreen Enterprises DI Khan.pdf",
  ],
  "fmt-f-simple-sales": ["Punjab Medicine Layyah 22.pdf", "Faiz Enterprises Rajanpur.pdf"],
  "fmt-g-code-product-net-sale": ["Chishti Pharma Multan.pdf", "Zavion Pharma Jhang.pdf"],
  "fmt-h-name-price-sales": ["Mashal Enterprises Bajaur.pdf"],
  "fmt-i-vertical-qty-bon": ["Hashmani Health Care Karachi.pdf"],
  "fmt-j-no-table": [
    "Ayan Pharma Taunsa.pdf",
    "Ch Medicine MWL.pdf",
    "Globar Enterprises SKP.PDF",
    "Mrwa Enterprises BWP.pdf",
    "Noor Khan Mingora.pdf",
    "Noor KHan minogra promotion30.pdf",
    "Zafar & Sons NWS.pdf",
    "New Tawakal Enterprises ABBT.pdf",
    "Bukhari Traders MBD.pdf",
    "AMT FSD.pdf",
    "Hamza Medicine TTS.pdf",
    "Life Care Distributor Gujrat.pdf",
    "The Hamza Traders Kasur.pdf",
  ],
};
