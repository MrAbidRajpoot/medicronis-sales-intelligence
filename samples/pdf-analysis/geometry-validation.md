# Geometry Validation — Previous Line Fallback PDFs

- Source: `D:\Downloads\July Closing.zip`
- Validated: 2026-08-16T12:19:14Z
- PDFs revalidated: **18**
- Exact method counts: **geometry 7 | table 1 | line_fallback 9 | fail 1**

## Results

- `Al Makkah Trading Buner.PDF` — **table**; rows 26, sales rows 0
- `Ayan Pharma Taunsa.pdf` — **geometry**; rows 43, sales rows 26
- `Bukhari Traders MBD.pdf` — **line_fallback**; rows 30, sales rows 26
- `Ch Medicine MWL.pdf` — **line_fallback**; rows 41, sales rows 24
- `Evergreen Enterprises DI Khan.pdf` — **geometry**; rows 3, sales rows 0
- `Faiz Enterprises Rajanpur.pdf` — **geometry**; rows 35, sales rows 32
- `Globar Enterprises SKP.PDF` — **line_fallback**; rows 28, sales rows 28
- `Hamed Pharma Bannu Promotion.pdf` — **geometry**; rows 14, sales rows 4
- `Hamed Pharma Bannu Trade.pdf` — **geometry**; rows 32, sales rows 19
- `Hashmani Health Care Karachi.pdf` — **geometry**; rows 26, sales rows 25
- `Life Care Distributor Gujrat.pdf` — **line_fallback**; rows 44, sales rows 30
- `Mrwa Enterprises BWP.pdf` — **line_fallback**; rows 32, sales rows 7
- `New Tawakal Enterprises ABBT.pdf` — **fail**; rows 0, sales rows 0
- `Noor Khan Mingora.pdf` — **line_fallback**; rows 33, sales rows 30
- `Noor KHan minogra promotion30.pdf` — **line_fallback**; rows 7, sales rows 6
- `The Hamza Traders Kasur.pdf` — **line_fallback**; rows 22, sales rows 22
- `Zafar & Sons NWS.pdf` — **line_fallback**; rows 14, sales rows 14
- `Zavion Pharma Jhang.pdf` — **geometry**; rows 41, sales rows 9

## Notes

- `table` includes the alternate pdfplumber settings path.
- `fail` means no extracted rows or an extraction error.
- Line fallback is only reached after both pdfplumber tables and geometry fail.
- New Tawakal is image-only and remains at 0 rows without OCR.
