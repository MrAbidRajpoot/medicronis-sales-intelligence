# Excel-only distributors

These distributors use **Excel compulsory** upload (`inputMode = EXCEL_ONLY`).
PDF and ZIP-with-PDF uploads are blocked. Configure the Excel column map at
`/distributors/[id]/excel-template` before uploading.

Codes are the exact values from `prisma/july-closing-distributors.ts`.

## Family J / problem PDFs

| Seed code | Notes / alternate label |
|-----------|-------------------------|
| `AYAN-TAUNSA` | Family J |
| `BUKHARI-MBD` | Family J |
| `CH-MED-MWL` | Label: CH-MEDICINE-MWL |
| `GLOBAL-SKP` | Label: GLOBAR-SKP (name: Globar Enterprises SKP) |
| `LIFE-CARE-GUJRAT` | Family J |
| `MRWA-BWP` | Family J |
| `TAWAKAL-ABBT` | Label: NEW-TAWAKAL-ABBT |
| `NOOR-KHAN-MINGORA` | Family J |
| `HAMZA-TRADERS-KASUR` | Label: HAMZA-KASUR |
| `ZAFAR-NWS` | Family J |
| `AMT-FSD` | Family J |

## Fragile line_fallback / related formats

| Seed code | Notes / alternate label |
|-----------|-------------------------|
| `AL-MAKKAH-BUNER` | Fragile line_fallback |
| `EVERGREEN-DIK` | Label: EVERGREEN-DIKHAN |
| `FAIZ-RAJANPUR` | Fragile line_fallback |
| `HAMED-BANNU-PROMO` | HAMED-BANNU\* |
| `HAMED-BANNU-TRADE` | HAMED-BANNU\* |
| `HASHMANI-KHI` | Fragile line_fallback |
| `ZAVION-JHANG` | Fragile line_fallback |

## Source of truth

- Code list: `prisma/excel-only-distributors.ts`
- Seed sets `Distributor.inputMode = EXCEL_ONLY` for these codes
- All other distributors remain `BOTH` (PDF + Excel allowed)
