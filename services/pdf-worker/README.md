# Medicronis PDF Worker

FastAPI service for PDF table extraction and product matching. Runs on port 8000 in local dev (`npm run worker:dev`).

## Config-driven extraction (Phase 8+)

The worker **does not read JSON files from disk**. Every extraction uses a `TemplateConfig` JSON object:

1. **Production path:** Node passes `template_config` from `DistributorTemplate.config` (merged with `PdfFormat.defaultConfig` at seed/wizard time).
2. **Standalone / analyze path:** If `template_config` is omitted, the worker auto-suggests a format via `presets.suggest_pdf_format()` using `detection.titlePatterns` and `detection.headerKeywords` from the A–J family presets (mirrored in `prisma/pdf-format-presets.ts`).

There is no `templates/` folder at runtime. Legacy file templates are archived under `samples/legacy-templates/`.

## API

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness |
| `POST /extract` | Extract product rows from PDF |
| `POST /extract-hint` | Distributor name from PDF header |
| `POST /analyze-headers` | Header grid + format suggestion for template wizard |
| `POST /match-rows` | Match extracted rows to catalog |
| `POST /match-suggestions` | Fuzzy product suggestions |

### POST /extract

Form fields:

| Field | Required | Description |
|-------|----------|-------------|
| `file` | yes | PDF upload |
| `template_config` | recommended | JSON `TemplateConfig` from DB |
| `format_code` | no | PdfFormat code hint (e.g. `fmt-a-ssr-stock-return`) |
| `distributor_code` | no | Metadata only — not used for file lookup |
| `use_ocr` | no | Tesseract fallback for scanned PDFs |

Response includes `suggested_format_code`, `extract_method` (`table` \| `alternate_settings` \| `line_fallback`), and `needs_template_remap`.

## Families A–J

Presets live in `presets.py` (Python) and `prisma/pdf-format-presets.ts` (TypeScript/DB seed). See [docs/pdf-families.md](../../docs/pdf-families.md).

Extraction pipeline:

1. **Table** — pdfplumber + label-path column resolver (`column_resolver.py`, `table_extractor.py`)
2. **Alternate settings** — optional `pdfPlumberSettings` in config (Family J outliers)
3. **Line fallback** — `line_parser.py` when tables collapse or Family J

Family A applies an automatic 16/17-column variant when SSR grouped headers are detected.

## Local setup

```bash
cd services/pdf-worker
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Or from repo root: `npm run worker:dev`

## Tests

```bash
cd services/pdf-worker
pytest tests/ -q
```

Integration tests for real PDFs skip when samples are not present. Set `MEDICRONIS_PDF_DIR` to a folder containing July Closing PDFs.

## OCR (optional)

Install Tesseract and `pytesseract` for scanned PDF support. Pass `use_ocr=true` on `/extract`.
