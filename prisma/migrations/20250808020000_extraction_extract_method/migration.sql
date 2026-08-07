-- AlterTable: store PDF extraction tier used (table | line_fallback | alternate_settings)
ALTER TABLE "ExtractionRun" ADD COLUMN "extractMethod" TEXT;
