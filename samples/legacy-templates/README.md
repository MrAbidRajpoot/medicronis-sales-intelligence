# Legacy file templates (archived)

These JSON files were used by the PDF worker before Phase 8 (config-driven extraction).

**Do not use at runtime.** Extraction now uses:

- `PdfFormat.defaultConfig` in PostgreSQL (seeded from `prisma/pdf-format-presets.ts`)
- Per-distributor overrides in `DistributorTemplate.config`

The demo `DIST-001` / `DIST-002` templates supported `scripts/generate_sample_pdfs.py` smoke PDFs only. Production July Closing PDFs use families A–J via `TemplateConfig`.
