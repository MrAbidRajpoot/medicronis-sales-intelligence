"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Save } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SamplePdfUpload } from "@/components/template-wizard/sample-pdf-upload";
import { FormatFamilySelect, type PdfFormatOption } from "@/components/template-wizard/format-family-select";
import { HeaderMappingGrid } from "@/components/template-wizard/header-mapping-grid";
import { LineParserSettings } from "@/components/template-wizard/line-parser-settings";
import { ExtractionPreviewTable } from "@/components/template-wizard/extraction-preview-table";
import { AdvancedTemplateSettings } from "@/components/template-wizard/advanced-template-settings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/toast-provider";
import type { ExtractedRowPayload } from "@/lib/pdf-worker";
import type { HeaderStructure, LineParserConfig, LineParserPreview, PdfPlumberSettings, TemplateConfig } from "@/lib/pdf-template-types";
import { getUnresolvedRequiredFields } from "@/lib/template-validation";
import { getDistributorLinePreset } from "@/lib/distributor-line-presets";
import {
  DEFAULT_LINE_PARSER,
  getLineFallbackIssues,
  isLineFallbackStructure,
  mergeLineParser,
} from "@/lib/line-fallback-utils";
import {
  assignmentsFromConfig,
  assignmentsFromSuggestedMappings,
  buildTemplateConfigFromAssignments,
  duplicateFieldColumns,
  type ColumnAssignment,
} from "@/lib/template-wizard-state";

interface PreviewResponse {
  suggestedFormatCode: string;
  confidence: number;
  headerStructure: HeaderStructure;
  headerGrid: string[][];
  detectedGroups: string[];
  suggestedMappings?: TemplateConfig["fields"];
  previewRows: ExtractedRowPayload[];
  unresolvedFields: string[];
  extractConfidence?: number;
  extractMethod?: string;
  templateResolutionOk?: boolean;
  usesLineParser?: boolean;
  lineParserPreview?: LineParserPreview | null;
}

interface TemplateWizardProps {
  distributorId: string;
  distributorName: string;
  distributorCode: string;
  isSetup?: boolean;
  returnTo?: string;
}

export function TemplateWizard({
  distributorId,
  distributorName,
  distributorCode,
  isSetup,
  returnTo,
}: TemplateWizardProps) {
  const router = useRouter();
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formats, setFormats] = useState<PdfFormatOption[]>([]);
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [pdfFormatId, setPdfFormatId] = useState("");
  const [headerGrid, setHeaderGrid] = useState<string[][]>([]);
  const [headerStructure, setHeaderStructure] = useState<HeaderStructure>("grouped_two_row");
  const [columnAssignments, setColumnAssignments] = useState<ColumnAssignment[]>([]);
  const [previewRows, setPreviewRows] = useState<ExtractedRowPayload[]>([]);
  const [suggestedCode, setSuggestedCode] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [skipRowsBeforeHeader, setSkipRowsBeforeHeader] = useState(0);
  const [skipRowsContaining, setSkipRowsContaining] = useState("");
  const [pdfPlumberSettings, setPdfPlumberSettings] = useState<PdfPlumberSettings>({});
  const [tableExtractionDisabled, setTableExtractionDisabled] = useState(false);
  const [lineParser, setLineParser] = useState<LineParserConfig>(DEFAULT_LINE_PARSER);
  const [lineParserPreview, setLineParserPreview] = useState<LineParserPreview | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const selectedFormat = formats.find((f) => f.id === pdfFormatId) ?? null;
  const isLineFallback = isLineFallbackStructure(headerStructure);

  function resolveLineParser(
    formatConfig?: TemplateConfig | null,
    existing?: LineParserConfig
  ): LineParserConfig {
    const distPreset = getDistributorLinePreset(distributorCode);
    return mergeLineParser(
      formatConfig?.lineParser,
      mergeLineParser(distPreset?.lineParser, existing)
    );
  }

  const config = useMemo(
    () =>
      buildTemplateConfigFromAssignments({
        headerStructure,
        headerGrid,
        columnAssignments,
        preset: selectedFormat?.defaultConfig ?? null,
        skipRowsBeforeHeader,
        skipRowsContaining: skipRowsContaining
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        pdfPlumberSettings,
        tableExtractionDisabled: isLineFallback ? true : tableExtractionDisabled,
        lineParser: isLineFallback ? lineParser : undefined,
      }),
    [
      headerStructure,
      headerGrid,
      columnAssignments,
      selectedFormat,
      skipRowsBeforeHeader,
      skipRowsContaining,
      pdfPlumberSettings,
      tableExtractionDisabled,
      lineParser,
      isLineFallback,
    ]
  );

  const unresolved = getUnresolvedRequiredFields(config);
  const lineFallbackIssues = isLineFallback ? getLineFallbackIssues(config, previewRows.length) : [];
  const dupes = isLineFallback ? [] : duplicateFieldColumns(columnAssignments);
  const canSave =
    !!sampleFile &&
    !!pdfFormatId &&
    (isLineFallback
      ? lineFallbackIssues.length === 0
      : unresolved.length === 0 && dupes.length === 0 && headerGrid.length > 0);

  const loadFormats = useCallback(async () => {
    const res = await fetch("/api/pdf-formats");
    if (!res.ok) throw new Error("Failed to load PDF formats");
    const data = (await res.json()) as PdfFormatOption[];
    setFormats(data);
    return data;
  }, []);

  const loadExistingTemplate = useCallback(async (formatList: PdfFormatOption[]) => {
    const res = await fetch(`/api/distributors/${distributorId}/template`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.pdfFormat?.id) {
      setPdfFormatId(data.pdfFormat.id);
    } else if (formatList.length > 0) {
      setPdfFormatId(formatList[0].id);
    }
    if (data.activeTemplate?.config) {
      const existing = data.activeTemplate.config as TemplateConfig;
      setHeaderStructure(existing.headerStructure ?? "grouped_two_row");
      setSkipRowsBeforeHeader(existing.skipRowsBeforeHeader ?? 0);
      setSkipRowsContaining((existing.skipRowsContaining ?? []).join(", "));
      setPdfPlumberSettings(existing.pdfPlumberSettings ?? {});
      setTableExtractionDisabled(existing.tableExtractionDisabled ?? false);
      if (existing.lineParser) {
        setLineParser(resolveLineParser(null, existing.lineParser));
      }
      if (isLineFallbackStructure(existing.headerStructure)) {
        setHeaderGrid([]);
        setColumnAssignments([]);
      } else if (existing.fields && Object.keys(existing.fields).length > 0) {
        const colCount =
          Math.max(...Object.values(existing.fields).map((m) => m?.col ?? -1), 0) + 1;
        setColumnAssignments(assignmentsFromConfig(existing, colCount));
      }
    }
    setInitialLoaded(true);
  }, [distributorId, distributorCode]);

  useEffect(() => {
    loadFormats()
      .then(loadExistingTemplate)
      .catch(() => toast.error("Failed to load template configuration"));
  }, [loadFormats, loadExistingTemplate]);

  const runPreview = useCallback(
    async (file: File, formatId: string, configOverride: TemplateConfig) => {
      setPreviewLoading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("pdfFormatId", formatId);
        form.append("config", JSON.stringify(configOverride));

        const res = await fetch(`/api/distributors/${distributorId}/template/preview`, {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Preview failed");

        const preview = data as PreviewResponse;
        setPreviewRows(preview.previewRows ?? []);
        if (preview.lineParserPreview) {
          setLineParserPreview(preview.lineParserPreview);
        }
        return preview;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Preview failed";
        setError(msg);
        return null;
      } finally {
        setPreviewLoading(false);
      }
    },
    [distributorId]
  );

  const analyzeSample = useCallback(
    async (file: File, formatId?: string) => {
      setAnalyzing(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("file", file);
        if (formatId) form.append("pdfFormatId", formatId);

        const res = await fetch(`/api/distributors/${distributorId}/template/preview`, {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Analysis failed");

        const preview = data as PreviewResponse;
        setSuggestedCode(preview.suggestedFormatCode);
        setConfidence(preview.confidence);
        setPreviewRows(preview.previewRows ?? []);
        if (preview.lineParserPreview) {
          setLineParserPreview(preview.lineParserPreview);
        }

        const formatForSuggest = formats.find((f) => f.code === preview.suggestedFormatCode);
        if (formatForSuggest && !formatId) {
          setPdfFormatId(formatForSuggest.id);
        }

        const preset =
          formatForSuggest?.defaultConfig ??
          selectedFormat?.defaultConfig ??
          (formatId ? formats.find((f) => f.id === formatId)?.defaultConfig : null);

        const lineMode =
          preview.usesLineParser ??
          isLineFallbackStructure(preview.headerStructure);

        if (lineMode) {
          setHeaderStructure("line_fallback");
          setHeaderGrid([]);
          setColumnAssignments([]);
          setTableExtractionDisabled(true);
          setLineParser(resolveLineParser(preset));
        } else {
          setHeaderStructure(preview.headerStructure ?? "grouped_two_row");
          setHeaderGrid(preview.headerGrid ?? []);
          const colCount = Math.max(
            preview.headerGrid?.[0]?.length ?? 0,
            preview.headerGrid?.[1]?.length ?? 0,
            0
          );
          setColumnAssignments(
            assignmentsFromSuggestedMappings(
              colCount,
              preview.suggestedMappings ?? preset?.fields ?? {}
            )
          );
          setTableExtractionDisabled(false);
        }

        if (preset) {
          setSkipRowsBeforeHeader(preset.skipRowsBeforeHeader ?? 0);
          setSkipRowsContaining((preset.skipRowsContaining ?? []).join(", "));
          setPdfPlumberSettings(preset.pdfPlumberSettings ?? {});
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Analysis failed");
      } finally {
        setAnalyzing(false);
      }
    },
    [distributorId, distributorCode, formats, selectedFormat]
  );

  useEffect(() => {
    if (!sampleFile) return;
    analyzeSample(sampleFile, pdfFormatId || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleFile]);

  useEffect(() => {
    if (!sampleFile || !pdfFormatId || !initialLoaded) return;
    if (!isLineFallback && headerGrid.length === 0) return;

    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      void runPreview(sampleFile, pdfFormatId, config);
    }, 400);

    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [sampleFile, pdfFormatId, config, headerGrid.length, initialLoaded, isLineFallback, runPreview]);

  function handleFormatChange(formatId: string) {
    setPdfFormatId(formatId);
    const format = formats.find((f) => f.id === formatId);
    if (format) {
      setHeaderStructure(format.headerStructure);
      if (format.defaultConfig.skipRowsBeforeHeader !== undefined) {
        setSkipRowsBeforeHeader(format.defaultConfig.skipRowsBeforeHeader);
      }
      setSkipRowsContaining((format.defaultConfig.skipRowsContaining ?? []).join(", "));
      setPdfPlumberSettings(format.defaultConfig.pdfPlumberSettings ?? {});
      if (isLineFallbackStructure(format.headerStructure)) {
        setTableExtractionDisabled(true);
        setHeaderGrid([]);
        setColumnAssignments([]);
        setLineParser(resolveLineParser(format.defaultConfig));
      } else {
        setTableExtractionDisabled(format.defaultConfig.tableExtractionDisabled ?? false);
      }
    }
    if (sampleFile) {
      void analyzeSample(sampleFile, formatId);
    }
  }

  function handleAssignmentChange(col: number, value: ColumnAssignment) {
    setColumnAssignments((prev) => {
      const next = [...prev];
      while (next.length <= col) next.push("ignore");
      if (value !== "ignore") {
        const existingIdx = next.findIndex((a, i) => a === value && i !== col);
        if (existingIdx >= 0) next[existingIdx] = "ignore";
      }
      next[col] = value;
      return next;
    });
  }

  async function handleSave() {
    if (!canSave || !sampleFile) return;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("pdfFormatId", pdfFormatId);
      form.append("config", JSON.stringify(config));
      form.append("sampleFile", sampleFile);

      const res = await fetch(`/api/distributors/${distributorId}/template`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      toast.success("PDF template saved — distributor is ready for uploads");
      if (data.warnings?.message) {
        toast.error(data.warnings.message);
      }

      if (returnTo) {
        router.push(returnTo);
      } else if (isSetup) {
        router.push("/distributors");
      } else {
        router.push("/distributors");
      }
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isSetup ? "Configure PDF Template" : "Update PDF Template"}
        description={`${distributorName} (${distributorCode}) — map PDF columns to canonical fields`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/distributors">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Distributors
            </Link>
          </Button>
        }
      />

      {isSetup && (
        <Alert variant="info">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Template required before upload</AlertTitle>
          <AlertDescription>
            {isLineFallback
              ? "This PDF uses text-line parsing (Family J). Click tokens on a sample line to assign fields until the live preview looks correct, then save."
              : "Complete this wizard to enable PDF uploads. Map RETURN/QTY, NET SALE/QTY, NET SALE/AMOUNT, and CLOSING/QTY for AIM-style reports."}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {dupes.length > 0 && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Duplicate field mappings</AlertTitle>
          <AlertDescription>
            Each field can only map to one column: {dupes.join(", ")}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">1. Sample PDF</CardTitle>
            </CardHeader>
            <CardContent>
              <SamplePdfUpload
                file={sampleFile}
                onFileChange={setSampleFile}
                disabled={analyzing}
              />
              {analyzing && (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing headers…
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">2. Format Family</CardTitle>
            </CardHeader>
            <CardContent>
              <FormatFamilySelect
                formats={formats}
                value={pdfFormatId}
                suggestedCode={suggestedCode}
                confidence={confidence}
                onChange={handleFormatChange}
                disabled={!sampleFile || analyzing}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                3. {isLineFallback ? "Line Parser Settings" : "Column Mapping"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLineFallback ? (
                <LineParserSettings
                  value={lineParser}
                  onChange={setLineParser}
                  disabled={!sampleFile || analyzing}
                  lineParserPreview={lineParserPreview}
                />
              ) : (
                <HeaderMappingGrid
                  headerGrid={headerGrid}
                  headerStructure={headerStructure}
                  columnAssignments={columnAssignments}
                  onAssignmentChange={handleAssignmentChange}
                  config={config}
                  disabled={!sampleFile || analyzing}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">5. Advanced</CardTitle>
            </CardHeader>
            <CardContent>
              <AdvancedTemplateSettings
                skipRowsBeforeHeader={skipRowsBeforeHeader}
                skipRowsContaining={skipRowsContaining}
                pdfPlumberSettings={pdfPlumberSettings}
                tableExtractionDisabled={tableExtractionDisabled}
                onSkipRowsBeforeHeaderChange={setSkipRowsBeforeHeader}
                onSkipRowsContainingChange={setSkipRowsContaining}
                onPdfPlumberSettingsChange={setPdfPlumberSettings}
                onTableExtractionDisabledChange={setTableExtractionDisabled}
                disabled={!sampleFile}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">4. Live Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <ExtractionPreviewTable rows={previewRows} loading={previewLoading} />
              {previewRows.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing first {previewRows.length} extracted row(s)
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {(isLineFallback ? lineFallbackIssues.length === 0 : unresolved.length === 0) ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>
                    {isLineFallback
                      ? lineFallbackIssues.length === 0
                        ? "Line parser ready — preview shows data"
                        : lineFallbackIssues.join("; ")
                      : unresolved.length === 0
                        ? "All required fields mapped"
                        : `Missing: ${unresolved.join(", ")}`}
                  </span>
                </div>
              </div>

              <Button
                variant="accent"
                className="w-full"
                disabled={!canSave || saving}
                onClick={handleSave}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Template
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
