/**
 * Historical July Closing problem-PDF codes that were once seeded as EXCEL_ONLY.
 * Seed no longer forces these — default is BOTH (PDF + Excel; Excel optional).
 * Operators may still set Distributor.inputMode = EXCEL_ONLY manually.
 *
 * See docs/excel-only-distributors.md
 */
export const HISTORICAL_EXCEL_ONLY_DISTRIBUTOR_CODES: readonly string[] = [
  // Family J / problem PDFs (formerly forced Excel-only)
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

/** Active seed force-list — empty. Keep enum BOTH | EXCEL_ONLY for manual use. */
export const EXCEL_ONLY_DISTRIBUTOR_CODES: readonly string[] = [] as const;

export const EXCEL_ONLY_CODE_SET = new Set(EXCEL_ONLY_DISTRIBUTOR_CODES);

export function isExcelOnlyDistributorCode(code: string): boolean {
  return EXCEL_ONLY_CODE_SET.has(code);
}
