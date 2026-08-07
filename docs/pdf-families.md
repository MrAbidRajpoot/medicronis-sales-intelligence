# PDF Format Families (July Closing)

Source analysis: `samples/pdf-analysis/july-closing-analysis.json` and `samples/pdf-analysis/RECOMMENDATIONS.md`.

Ten layout families (A–J) cover all 46 July Closing distributor PDFs. Family **Z** outliers are assigned the closest preset until custom parsers are built (Phase 4).

## Family A — SSR Stock & Return

**Format code:** `fmt-a-ssr-stock-return`  
**Header:** grouped two-row (`ITEM | RATE | … | NET SALE | CLOSING`)  
**Column variants:** 17-col default; 16-col via distributor `templateConfig` override (label-path resolves NET SALE).

| PDF |
|-----|
| AIM Pharma HYD.pdf |
| Lal Drug Agency Sibbi.pdf |
| Reliable Pharma MPK.pdf |
| Al Haram Enterprises Kohat.pdf *(16-col override)* |

## Family B — Medicronis ERP Sales and Stock Statement

**Format code:** `fmt-b-medicronis-erp`  
**Header:** title block then 16-col table (`DESCRIPTION | TP | NET SALE | CLOSING`)

| PDF |
|-----|
| AL Shifa Enterprises Jampur.pdf |
| AQ Enterprises Sargodha.pdf |
| Al Harmain ENterprises DG Khan.pdf |
| N&G Enterprises SWL.pdf |
| Wellcome Pharma alipur.pdf |
| sHAHZAIB pHARMA Okara30.pdf |
| Ruman Medicine Promotion RYK.pdf *(Z outlier — ERP layout)* |
| Ruman Medicine Trade RYK.pdf *(Z outlier)* |
| Evergreen Enterprises DI Khan.pdf *(Z outlier — title-only table)* |

## Family C — Item Description / Net Sales

**Format code:** `fmt-c-item-desc-net-sales`  
**Header:** grouped two-row (`Item Description | PURCHASE | SALE → Net Sales / Value`)  
**Column variants:** 13 / 14 / 15 col — same preset, label-path resolution.

| PDF |
|-----|
| Al Rehman  Medical Sources Lahore.pdf |
| Al Rehman Medical Sources Lahore.pdf |
| Bashir Pharma Gujranwala.pdf |
| M&C RWP.pdf |
| Pharmarite Distributor Jehlum.pdf |
| Shafiq Medicine Company Khanpur.pdf |
| Haji Nizam & Sons Quetta.pdf |

## Family D — Product Name T.P. Tax

**Format code:** `fmt-d-product-name-tp-tax`  
**Header:** 19-col grouped two-row

| PDF |
|-----|
| Al Makkah Trading Buner.PDF |
| Kamal Medicine Company Timergarah.PDF |
| Medicamp PSW.PDF |
| Umar Medicine Swabi.PDF |

## Family E — TRAD RATE / NET SALE

**Format code:** `fmt-e-trad-rate-net-sale`  
**Header:** grouped two-row (`TRAD RATE | RECEIPT | SALE → NET SALE / AMOUNT`)

| PDF |
|-----|
| Hamed Pharma Bannu Promotion.pdf |
| Hamed Pharma Bannu Trade.pdf |
| Mehran Traders Mardan.pdf |

## Family F — Simple Description / Sales Qty / Sale Value

**Format code:** `fmt-f-simple-sales`  
**Header:** single row, 10 columns

| PDF |
|-----|
| Punjab Medicine Layyah 22.pdf |
| Faiz Enterprises Rajanpur.pdf *(Z outlier — merged 1-col header)* |

## Family G — Code / Product / Net Sale

**Format code:** `fmt-g-code-product-net-sale`  
**Header:** Chishti (16-col single row) and Zavion (14-col two-row) — label-path + col fallbacks

| PDF |
|-----|
| Chishti Pharma Multan.pdf |
| Zavion Pharma Jhang.pdf |

## Family H — NAME / PRICE / OPEN STOCK / SALES

**Format code:** `fmt-h-name-price-sales`  
**Header:** 21-col grouped layout

| PDF |
|-----|
| Mashal Enterprises Bajaur.pdf |

## Family I — Vertical NET SALES QTY.BON AMOUNT

**Format code:** `fmt-i-vertical-qty-bon`  
**Header:** 7-col vertical stacked headers

| PDF |
|-----|
| Hashmani Health Care Karachi.pdf |

## Family J — No table / line parser fallback

**Format code:** `fmt-j-no-table`  
**Config:** `headerStructure: line_fallback`, `tableExtractionDisabled: true`  
**Extraction:** line parser only (Phase 5). OCR not enabled.

| PDF |
|-----|
| Ayan Pharma Taunsa.pdf |
| Ch Medicine MWL.pdf |
| Globar Enterprises SKP.PDF |
| Mrwa Enterprises BWP.pdf |
| Noor Khan Mingora.pdf |
| Noor KHan minogra promotion30.pdf |
| Zafar & Sons NWS.pdf |
| New Tawakal Enterprises ABBT.pdf *(no extractable text — scanned)* |
| Bukhari Traders MBD.pdf |
| AMT FSD.pdf *(Z — collapsed table)* |
| Hamza Medicine TTS.pdf *(Z)* |
| Life Care Distributor Gujrat.pdf *(Z — summary only)* |
| The Hamza Traders Kasur.pdf *(Z)* |

## Detection

Auto-suggest uses `titlePatterns` and `headerKeywords` in each preset's `defaultConfig.detection` (stored in `PdfFormat.defaultConfig`):

- **Python:** `presets.suggest_pdf_format(pdf_bytes) → { code, confidence, family }`
- **TypeScript:** `suggestPdfFormat(text, tableHints) → { code, confidence, family }`

The worker does **not** load file templates. Node always passes `template_config` from the database on upload; auto-suggest is used by `/analyze-headers` and when calling `/extract` without config.

Re-run analysis: `python scripts/analyze_distributor_pdfs.py "path/to/pdfs.zip"`
