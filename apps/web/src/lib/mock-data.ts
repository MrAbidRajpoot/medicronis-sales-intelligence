export type DocumentStatus =
  | "UPLOADED"
  | "PROCESSING"
  | "EXTRACTED"
  | "REVIEW_REQUIRED"
  | "APPROVED"
  | "FAILED";

export type ExtractedRowStatus = "PENDING" | "MATCHED" | "UNMATCHED" | "REVIEWED" | "REJECTED";

export type SsrReportStatus = "GENERATING" | "READY" | "FAILED";

export interface Distributor {
  id: string;
  code: string;
  name: string;
  region: string;
}

export interface Product {
  sku: string;
  name: string;
  category: string;
}

export interface Document {
  id: string;
  fileName: string;
  distributorId: string;
  distributorName: string;
  status: DocumentStatus;
  uploadedAt: string;
  periodStart: string;
  periodEnd: string;
  rowCount: number;
  matchedCount: number;
  fileSize: number;
}

export interface ExtractedRow {
  id: string;
  rowIndex: number;
  rawProductText: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  status: ExtractedRowStatus;
  productSku?: string;
  productName?: string;
}

export interface ReviewItem {
  id: string;
  documentId: string;
  documentName: string;
  distributorName: string;
  rawProductText: string;
  suggestedSku: string;
  suggestedName: string;
  confidence: number;
  quantity: number;
}

export interface SsrReport {
  id: string;
  batchCode: string;
  distributorName: string;
  periodStart: string;
  periodEnd: string;
  status: SsrReportStatus;
  lineCount: number;
  totalValue: number;
  generatedAt?: string;
}

export interface SsrLine {
  sku: string;
  productName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ActivityItem {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
}

export const DISTRIBUTORS: Distributor[] = [
  { id: "dist-001", code: "DIST-001", name: "MedSupply Karachi", region: "Sindh" },
  { id: "dist-002", code: "DIST-002", name: "PharmaLink Lahore", region: "Punjab" },
  { id: "dist-003", code: "DIST-003", name: "HealthFirst Islamabad", region: "ICT" },
  { id: "dist-004", code: "DIST-004", name: "CarePlus Peshawar", region: "KPK" },
  { id: "dist-005", code: "DIST-005", name: "Wellness Hub Quetta", region: "Balochistan" },
];

export const PRODUCTS: Product[] = [
  { sku: "MED-001", name: "Amoxicillin 500mg Caps", category: "Antibiotic" },
  { sku: "MED-002", name: "Paracetamol 500mg Tab", category: "Analgesic" },
  { sku: "MED-003", name: "Omeprazole 20mg Cap", category: "GI" },
  { sku: "MED-004", name: "Metformin 500mg Tab", category: "Diabetes" },
  { sku: "MED-005", name: "Atorvastatin 10mg Tab", category: "Cardiovascular" },
  { sku: "MED-006", name: "Amlodipine 5mg Tab", category: "Cardiovascular" },
  { sku: "MED-007", name: "Losartan 50mg Tab", category: "Cardiovascular" },
  { sku: "MED-008", name: "Azithromycin 250mg Tab", category: "Antibiotic" },
  { sku: "MED-009", name: "Ciprofloxacin 500mg Tab", category: "Antibiotic" },
  { sku: "MED-010", name: "Ibuprofen 400mg Tab", category: "Analgesic" },
  { sku: "MED-011", name: "Cetirizine 10mg Tab", category: "Allergy" },
  { sku: "MED-012", name: "Pantoprazole 40mg Tab", category: "GI" },
  { sku: "MED-013", name: "Glimepiride 2mg Tab", category: "Diabetes" },
  { sku: "MED-014", name: "Insulin Glargine 100IU", category: "Diabetes" },
  { sku: "MED-015", name: "Salbutamol Inhaler 100mcg", category: "Respiratory" },
];

export const DOCUMENTS: Document[] = [
  {
    id: "doc-001",
    fileName: "MedSupply_Sales_Jul2026.pdf",
    distributorId: "dist-001",
    distributorName: "MedSupply Karachi",
    status: "APPROVED",
    uploadedAt: "2026-08-01T09:15:00Z",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    rowCount: 48,
    matchedCount: 46,
    fileSize: 284000,
  },
  {
    id: "doc-002",
    fileName: "PharmaLink_Statement_Aug2026.pdf",
    distributorId: "dist-002",
    distributorName: "PharmaLink Lahore",
    status: "REVIEW_REQUIRED",
    uploadedAt: "2026-08-02T14:30:00Z",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    rowCount: 62,
    matchedCount: 54,
    fileSize: 412000,
  },
  {
    id: "doc-003",
    fileName: "HealthFirst_Monthly_Jul2026.pdf",
    distributorId: "dist-003",
    distributorName: "HealthFirst Islamabad",
    status: "PROCESSING",
    uploadedAt: "2026-08-03T08:00:00Z",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    rowCount: 0,
    matchedCount: 0,
    fileSize: 356000,
  },
  {
    id: "doc-004",
    fileName: "CarePlus_SalesReport_Jul2026.pdf",
    distributorId: "dist-004",
    distributorName: "CarePlus Peshawar",
    status: "EXTRACTED",
    uploadedAt: "2026-08-02T11:45:00Z",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    rowCount: 35,
    matchedCount: 35,
    fileSize: 198000,
  },
  {
    id: "doc-005",
    fileName: "WellnessHub_InvoiceBatch_Jul2026.pdf",
    distributorId: "dist-005",
    distributorName: "Wellness Hub Quetta",
    status: "FAILED",
    uploadedAt: "2026-08-01T16:20:00Z",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    rowCount: 0,
    matchedCount: 0,
    fileSize: 520000,
  },
  {
    id: "doc-006",
    fileName: "MedSupply_Supplementary_Aug2026.pdf",
    distributorId: "dist-001",
    distributorName: "MedSupply Karachi",
    status: "UPLOADED",
    uploadedAt: "2026-08-03T10:30:00Z",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-03",
    rowCount: 0,
    matchedCount: 0,
    fileSize: 145000,
  },
];

export const EXTRACTED_ROWS: Record<string, ExtractedRow[]> = {
  "doc-001": [
    { id: "row-1", rowIndex: 1, rawProductText: "AMOXICILLIN 500MG CAPS", quantity: 1200, unitPrice: 18, lineTotal: 21600, status: "MATCHED", productSku: "MED-001", productName: "Amoxicillin 500mg Caps" },
    { id: "row-2", rowIndex: 2, rawProductText: "PARACETAMOL TAB 500", quantity: 5000, unitPrice: 3, lineTotal: 15000, status: "MATCHED", productSku: "MED-002", productName: "Paracetamol 500mg Tab" },
    { id: "row-3", rowIndex: 3, rawProductText: "Omeprazole 20mg Cap", quantity: 800, unitPrice: 22, lineTotal: 17600, status: "MATCHED", productSku: "MED-003", productName: "Omeprazole 20mg Cap" },
    { id: "row-4", rowIndex: 4, rawProductText: "Metformin HCl 500", quantity: 2400, unitPrice: 8, lineTotal: 19200, status: "MATCHED", productSku: "MED-004", productName: "Metformin 500mg Tab" },
    { id: "row-5", rowIndex: 5, rawProductText: "Atorvastatin-10", quantity: 600, unitPrice: 35, lineTotal: 21000, status: "MATCHED", productSku: "MED-005", productName: "Atorvastatin 10mg Tab" },
    { id: "row-6", rowIndex: 6, rawProductText: "UNKNOWN PROD XYZ", quantity: 100, unitPrice: 0, lineTotal: 0, status: "UNMATCHED" },
    { id: "row-7", rowIndex: 7, rawProductText: "Salbutamol MDI 100", quantity: 350, unitPrice: 280, lineTotal: 98000, status: "MATCHED", productSku: "MED-015", productName: "Salbutamol Inhaler 100mcg" },
  ],
  "doc-002": [
    { id: "row-8", rowIndex: 1, rawProductText: "Omeprazole 20mg", quantity: 1500, unitPrice: 22, lineTotal: 33000, status: "MATCHED", productSku: "MED-003", productName: "Omeprazole 20mg Cap" },
    { id: "row-9", rowIndex: 2, rawProductText: "Metformin HCl 500", quantity: 3200, unitPrice: 8, lineTotal: 25600, status: "MATCHED", productSku: "MED-004", productName: "Metformin 500mg Tab" },
    { id: "row-10", rowIndex: 3, rawProductText: "Cetrizine 10mg (typo)", quantity: 900, unitPrice: 5, lineTotal: 4500, status: "UNMATCHED" },
    { id: "row-11", rowIndex: 4, rawProductText: "IBUPROFEN 400 TAB", quantity: 1800, unitPrice: 6, lineTotal: 10800, status: "MATCHED", productSku: "MED-010", productName: "Ibuprofen 400mg Tab" },
  ],
  "doc-004": [
    { id: "row-12", rowIndex: 1, rawProductText: "Azithro 250mg", quantity: 750, unitPrice: 45, lineTotal: 33750, status: "MATCHED", productSku: "MED-008", productName: "Azithromycin 250mg Tab" },
    { id: "row-13", rowIndex: 2, rawProductText: "Ciprofloxacin HCl 500", quantity: 420, unitPrice: 38, lineTotal: 15960, status: "MATCHED", productSku: "MED-009", productName: "Ciprofloxacin 500mg Tab" },
  ],
};

export const REVIEW_QUEUE: ReviewItem[] = [
  {
    id: "rev-001",
    documentId: "doc-002",
    documentName: "PharmaLink_Statement_Aug2026.pdf",
    distributorName: "PharmaLink Lahore",
    rawProductText: "Cetrizine 10mg (typo)",
    suggestedSku: "MED-011",
    suggestedName: "Cetirizine 10mg Tab",
    confidence: 0.87,
    quantity: 900,
  },
  {
    id: "rev-002",
    documentId: "doc-001",
    documentName: "MedSupply_Sales_Jul2026.pdf",
    distributorName: "MedSupply Karachi",
    rawProductText: "UNKNOWN PROD XYZ",
    suggestedSku: "",
    suggestedName: "",
    confidence: 0,
    quantity: 100,
  },
  {
    id: "rev-003",
    documentId: "doc-002",
    documentName: "PharmaLink_Statement_Aug2026.pdf",
    distributorName: "PharmaLink Lahore",
    rawProductText: "PANTO 40MG TAB",
    suggestedSku: "MED-012",
    suggestedName: "Pantoprazole 40mg Tab",
    confidence: 0.92,
    quantity: 650,
  },
  {
    id: "rev-004",
    documentId: "doc-002",
    documentName: "PharmaLink_Statement_Aug2026.pdf",
    distributorName: "PharmaLink Lahore",
    rawProductText: "GLIM 2MG",
    suggestedSku: "MED-013",
    suggestedName: "Glimepiride 2mg Tab",
    confidence: 0.78,
    quantity: 1100,
  },
];

export const SSR_REPORTS: SsrReport[] = [
  {
    id: "ssr-001",
    batchCode: "SSR-2026-07-001",
    distributorName: "MedSupply Karachi",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    status: "READY",
    lineCount: 46,
    totalValue: 2847500,
    generatedAt: "2026-08-01T11:30:00Z",
  },
  {
    id: "ssr-002",
    batchCode: "SSR-2026-07-002",
    distributorName: "CarePlus Peshawar",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    status: "READY",
    lineCount: 35,
    totalValue: 1923400,
    generatedAt: "2026-08-02T15:00:00Z",
  },
  {
    id: "ssr-003",
    batchCode: "SSR-2026-07-003",
    distributorName: "PharmaLink Lahore",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    status: "GENERATING",
    lineCount: 0,
    totalValue: 0,
  },
];

export const SSR_LINES: Record<string, SsrLine[]> = {
  "ssr-001": [
    { sku: "MED-001", productName: "Amoxicillin 500mg Caps", category: "Antibiotic", quantity: 1200, unitPrice: 18, lineTotal: 21600 },
    { sku: "MED-002", productName: "Paracetamol 500mg Tab", category: "Analgesic", quantity: 5000, unitPrice: 3, lineTotal: 15000 },
    { sku: "MED-003", productName: "Omeprazole 20mg Cap", category: "GI", quantity: 800, unitPrice: 22, lineTotal: 17600 },
    { sku: "MED-004", productName: "Metformin 500mg Tab", category: "Diabetes", quantity: 2400, unitPrice: 8, lineTotal: 19200 },
    { sku: "MED-005", productName: "Atorvastatin 10mg Tab", category: "Cardiovascular", quantity: 600, unitPrice: 35, lineTotal: 21000 },
    { sku: "MED-015", productName: "Salbutamol Inhaler 100mcg", category: "Respiratory", quantity: 350, unitPrice: 280, lineTotal: 98000 },
  ],
  "ssr-002": [
    { sku: "MED-008", productName: "Azithromycin 250mg Tab", category: "Antibiotic", quantity: 750, unitPrice: 45, lineTotal: 33750 },
    { sku: "MED-009", productName: "Ciprofloxacin 500mg Tab", category: "Antibiotic", quantity: 420, unitPrice: 38, lineTotal: 15960 },
  ],
};

export const RECENT_ACTIVITY: ActivityItem[] = [
  { id: "act-1", action: "SSR Generated", detail: "SSR-2026-07-001 for MedSupply Karachi", timestamp: "2026-08-01T11:30:00Z" },
  { id: "act-2", action: "Document Approved", detail: "MedSupply_Sales_Jul2026.pdf — 46/48 rows matched", timestamp: "2026-08-01T10:45:00Z" },
  { id: "act-3", action: "Review Required", detail: "PharmaLink_Statement_Aug2026.pdf — 8 exceptions", timestamp: "2026-08-02T14:35:00Z" },
  { id: "act-4", action: "SSR Generated", detail: "SSR-2026-07-002 for CarePlus Peshawar", timestamp: "2026-08-02T15:00:00Z" },
  { id: "act-5", action: "Upload Failed", detail: "WellnessHub_InvoiceBatch_Jul2026.pdf — unreadable format", timestamp: "2026-08-01T16:25:00Z" },
  { id: "act-6", action: "Document Uploaded", detail: "MedSupply_Supplementary_Aug2026.pdf", timestamp: "2026-08-03T10:30:00Z" },
];

export const KPI = {
  totalSales: 4770900,
  pendingDocs: 3,
  matchRate: 94.2,
  activeDistributors: 5,
};

export function getDocument(id: string): Document | undefined {
  return DOCUMENTS.find((d) => d.id === id);
}

export function getSsrReport(id: string): SsrReport | undefined {
  return SSR_REPORTS.find((r) => r.id === id);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
