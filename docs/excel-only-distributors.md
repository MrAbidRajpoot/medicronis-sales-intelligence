# Excel-only distributors (historical)

**Default input mode is `BOTH`** (PDF + Excel allowed). Excel column maps remain
optional for BOTH — configure at `/distributors/[id]/excel-template` when uploading
`.xlsx`. PDF upload works whenever a PDF template/geometry is ready.

`inputMode = EXCEL_ONLY` still exists for **manual** use: set it on a distributor
when you intentionally want to block PDF and require Excel. Seed does **not**
force Excel-only for any July Closing codes.

## Historical problem-PDF list

These codes were previously seeded as `EXCEL_ONLY` (fragile Family J /
line_fallback layouts). They now seed as `BOTH` so PDF upload is allowed again
(subject to PDF template/geometry). The list below is historical reference only.

Codes match `prisma/july-closing-distributors.ts`.

### Family J / problem PDFs

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

### Fragile line_fallback / related formats

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

- Historical codes: `prisma/excel-only-distributors.ts` (`HISTORICAL_EXCEL_ONLY_DISTRIBUTOR_CODES`)
- Seed sets `Distributor.inputMode = BOTH` for all July Closing distributors
- `EXCEL_ONLY` remains available via the Distributors UI / API for intentional use
