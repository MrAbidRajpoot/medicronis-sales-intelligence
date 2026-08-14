/**
 * Distributors forced to Excel-only upload (fragile / Family-J PDF layouts).
 * Codes must match prisma/july-closing-distributors.ts exactly.
 *
 * See docs/excel-only-distributors.md for the human-readable list and PDF labels.
 */
export const EXCEL_ONLY_DISTRIBUTOR_CODES: readonly string[] = [
  // Family J / problem PDFs
  "AYAN-TAUNSA",
  "BUKHARI-MBD",
  "CH-MED-MWL", // label: CH-MEDICINE-MWL
  "GLOBAL-SKP", // label: GLOBAR-SKP
  "LIFE-CARE-GUJRAT",
  "MRWA-BWP",
  "TAWAKAL-ABBT", // label: NEW-TAWAKAL-ABBT
  "NOOR-KHAN-MINGORA",
  "HAMZA-TRADERS-KASUR", // label: HAMZA-KASUR
  "ZAFAR-NWS",
  "AMT-FSD",
  // Fragile line_fallback / related formats
  "AL-MAKKAH-BUNER",
  "EVERGREEN-DIK", // label: EVERGREEN-DIKHAN
  "FAIZ-RAJANPUR",
  "HAMED-BANNU-PROMO",
  "HAMED-BANNU-TRADE",
  "HASHMANI-KHI",
  "ZAVION-JHANG",
] as const;

export const EXCEL_ONLY_CODE_SET = new Set(EXCEL_ONLY_DISTRIBUTOR_CODES);

export function isExcelOnlyDistributorCode(code: string): boolean {
  return EXCEL_ONLY_CODE_SET.has(code);
}
