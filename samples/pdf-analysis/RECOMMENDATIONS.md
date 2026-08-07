# July Closing — PDF Format Analysis & Recommendations

**Source:** `d:\Downloads\July Closing.zip`  
**Analyzed:** 46 distributor PDFs  
**Date:** August 2026  

---

## Executive summary

| Metric | Result |
|--------|--------|
| PDFs with detectable tables | 37 / 46 |
| **Current worker extracts sales (qty > 0)** | **22 / 46 (48%)** |
| Raw layout clusters | 31 |
| **Recommended format families** | **10** (not 46) |

**Key finding:** Most distributors do **not** need their own template. They fall into ~10 layout families. The biggest gap is that only **one family** (`ssr-stock-return`) is implemented as a dedicated parser; everything else falls through to `generic`, which fails on multi-row headers.

---

## Recommended format families

### Family A — SSR Stock & Return (ITEM / RATE / NET SALE) ✅ Partially built

**Parser:** `ssr_stock_return` (exists today as `ssr-stock-return.json`)  
**Detection:** `SALES, STOCK & RETURN` in header  
**Layout:** 2-row header; fixed column indices (may vary by col count)

| Status | File | Cols | Sales rows extracted |
|--------|------|------|---------------------|
| ✅ Works | AIM Pharma HYD.pdf | 17 | 29 |
| ✅ Works | Lal Drug Agency Sibbi.pdf | 17 | ~20 |
| ✅ Works | Reliable Pharma MPK.pdf | 17 | ~20 |
| ⚠️ Partial | Al Haram Enterprises Kohat.pdf | **16** | 4 (wrong columns — needs col-count variant) |

**Action:** Add `ssr-stock-return-16col` variant OR dynamic net-sale column detection. Assign all 4 distributors to Family A.

---

### Family B — Medicronis “Sales and Stock Statement” (ERP export) ⚠️ Partially working

**Detection:** Title row `Sales and Stock Statement` + date range line  
**Layout:** Title rows then product table (often mis-detected by pdfplumber)

| File | Sales rows (generic parser) |
|------|----------------------------|
| AL Shifa Enterprises Jampur.pdf | 2 |
| AQ Enterprises Sargodha.pdf | 8 |
| Al Harmain ENterprises DG Khan.pdf | 3 |
| N&G Enterprises SWL.pdf | 1 |
| Wellcome Pharma alipur.pdf | 1 |
| sHAHZAIB pHARMA Okara30.pdf | 1 |

**Action:** New parser `fmt-medicronis-erp-statement` — skip first N title rows, find row with `Description`/`Product`/`Item`, map Net Sales Qty + Value columns. **6 distributors, 1 template.**

---

### Family C — Item Description / Opening / PURCHASE / SALE (2-row) ❌ Not supported

**Layout:** Row0: `Item Description | Rate | Pack | Opening Balance | PURCHASE | SALE`  
Row1 sub-headers: `Purchase | Return | Total | Net Sales | Bonus | Value`

| File |
|------|
| Al Rehman Medical Sources Lahore.pdf (×2) |
| Bashir Pharma Gujranwala.pdf |
| M&C RWP.pdf |
| Pharmarite Distributor Jehlum.pdf |
| Shafiq Medicine Company Khanpur.pdf |

**Action:** New parser `fmt-item-desc-net-sales` — locate `Net Sales` + `Value` sub-columns under SALE group. **6 distributors, 1 template** (13 vs 15 col variants = alias config only).

---

### Family D — Product Name T.P. Tax / Opening / Purchase / B.C / Sale ❌ Not supported

**Layout:** 19 columns, 2-row header starting with `Product Name T.P. Tax`

| File |
|------|
| Al Makkah Trading Buner.PDF |
| Kamal Medicine Company Timergarah.PDF |
| Medicamp PSW.PDF |
| Umar Medicine Swabi.PDF |

**Action:** New parser `fmt-product-name-tp-tax`. **4 distributors, 1 template.**

---

### Family E — TRAD RATE / OPENING / RECEIPT / NET SALE ❌ Not supported (but generic accidentally works)

**Layout:** Row0: `TRAD RATE | OPENING BALANCE | RECEIPT | SALE`  
Row1: `QUANTITY AMOUNT | SALE | RETURN | NET SALE | AMOUNT`

| File | Sales rows |
|------|-----------|
| Hamed Pharma Bannu Promotion.pdf | ✅ |
| Hamed Pharma Bannu Trade.pdf | ✅ |
| Mehran Traders Mardan.pdf | ✅ |

**Action:** Formalize as `fmt-trad-rate-net-sale` for reliability (generic is fragile). **3 distributors, 1 template.**

---

### Family F — Simple single-row: Description / Sales Qty / Sale Value ❌ Not supported

| File |
|------|
| Punjab Medicine Layyah 22.pdf |

**Action:** Standard `field_mapping` template. **1 distributor** (may match others later).

---

### Family G — Code / Product / TP / Opening / Purchase / Net Sale ❌ Not supported

| File |
|------|
| Chishti Pharma Multan.pdf |
| Zavion Pharma Jhang.pdf |

**Action:** Parser `fmt-code-product-net-sale` with 2-row header. **2 distributors, 1 template.**

---

### Family H — NAME / PRICE / OPEN STOCK / RECEIPT / SALES ❌ Not supported (partial generic)

| File | Sales rows |
|------|-----------|
| Mashal Enterprises Bajaur.pdf | 23 |

**Action:** Parser `fmt-name-price-sales` (21 col). **1 distributor.**

---

### Family I — NET SALES QTY.BON AMOUNT (vertical headers) ❌ Not supported (partial generic)

| File | Sales rows |
|------|-----------|
| Hashmani Health Care Karachi.pdf | 25 |

**Action:** Parser `fmt-vertical-qty-bon-amount`. **1 distributor.**

---

### Family J — No table / text-only / broken pdfplumber ❌ Needs investigation

| File | Notes |
|------|-------|
| Ayan Pharma Taunsa.pdf | Has text, no tables detected |
| Ch Medicine MWL.pdf | Same |
| Globar Enterprises SKP.PDF | Same |
| Mrwa Enterprises BWP.pdf | Same |
| Noor Khan Mingora.pdf | 2 pages, no tables |
| Noor KHan minogra promotion30.pdf | Same |
| Zafar & Sons NWS.pdf | Same |
| New Tawakal Enterprises ABBT.pdf | **No text** — likely scanned image |
| Bukhari Traders MBD.pdf | STOCK STATEMENT text, line fallback works partially |

**Action:** Inspect each — may need alternate table settings, line parser, or OCR. Possibly same ERP as Family B but pdfplumber splits differently.

---

### Family Z — Odd / malformed extraction ❌ Custom work

| File | Issue |
|------|-------|
| AMT FSD.pdf | Table collapsed to 1 column |
| Evergreen Enterprises DI Khan.pdf | Title-only rows detected as table |
| Faiz Enterprises Rajanpan.pdf | All headers merged into 1 cell |
| Haji Nizam & Sons Quetta.pdf | 15-col variant of Family C |
| Hamza Medicine TTS.pdf | Data rows detected as headers |
| Life Care Distributor Gujrat.pdf | Summary-only cells |
| Ruman Medicine Promotion/Trade RYK.pdf | Transposed header layout |
| The Hamza Traders Kasur.pdf | Group title only |

**Action:** Per-file pdfplumber tuning or custom parser. Some may be fixable by Family C/E rules once built.

---

## Coverage roadmap

| Phase | Format families | Distributors covered | Cumulative |
|-------|-----------------|---------------------|------------|
| **Now** | A (SSR 17-col) | 3 | 3 (7%) |
| **Phase 1** | A fix 16-col, B, C, E | +14 | 17 (37%) |
| **Phase 2** | D, G (code/product), F | +7 | 24 (52%) |
| **Phase 3** | H, I, J investigation | +10 | 34 (74%) |
| **Phase 4** | Z outliers + OCR | +12 | 46 (100%) |

---

## Architecture recommendation

```
PdfFormat (DB)
├── fmt-ssr-stock-return-17
├── fmt-ssr-stock-return-16
├── fmt-medicronis-erp-statement
├── fmt-item-desc-net-sales
├── fmt-product-name-tp-tax
├── fmt-trad-rate-net-sale
└── ...

Distributor.pdfFormatId → assigned format (required before upload)
Optional pdfConfigOverride → extra column aliases only
```

**Do not create 46 JSON files.** Assign each distributor to one of ~10 formats via admin UI.

---

## Distributor → format assignment (July Closing set)

| Format | Distributors |
|--------|-------------|
| **A** SSR Stock & Return | AIM Pharma HYD, Lal Drug Agency Sibbi, Reliable Pharma MPK, Al Haram Kohat |
| **B** Medicronis ERP Statement | AL Shifa Jampur, AQ Sargodha, Al Harmain DG Khan, N&G SWL, Wellcome Ali Pur, Shahzaib Okara |
| **C** Item Desc / Net Sales | Al Rehman Lahore, Bashir Gujranwala, M&C RWP, Pharmarite Jehlum, Shafiq Khanpur, Haji Nizam Quetta |
| **D** Product Name TP Tax | Al Makkah Buner, Kamal Timergarah, Medicamp PSW, Umar Swabi |
| **E** Trad Rate / Net Sale | Hamed Bannu (×2), Mehran Mardan |
| **F** Simple Sales Qty/Value | Punjab Medicine Layyah |
| **G** Code / Product / TP | Chishti Multan, Zavion Jhang |
| **H** Name / Price / Sales | Mashal Bajaur |
| **I** Qty.Bon Amount | Hashmani Karachi |
| **J** No table / OCR | Ayan Taunsa, Ch Medicine MWL, Global SKP, MRWA BWP, Noor Khan (×2), Zafar NWS, New Tawakal ABBT, Bukhari MBD |
| **Z** Custom | AMT FSD, Evergreen DI Khan, Faiz Rajanpur, Hamza TTS, Life Care Gujrat, Ruman RYK (×2), Hamza Traders Kasur |

---

## Files generated

- `samples/pdf-analysis/july-closing-analysis.json` — full per-PDF data
- `samples/pdf-analysis/july-closing-report.md` — raw cluster listing
- `scripts/analyze_distributor_pdfs.py` — reusable analysis script

Re-run: `python scripts/analyze_distributor_pdfs.py "path/to/pdfs.zip"`
