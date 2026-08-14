"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/toast-provider";
import type { ExcelCanonicalField, ExcelTemplateConfig } from "@/lib/excel-template-types";
import {
  EXCEL_CANONICAL_FIELDS,
  EXCEL_RECOMMENDED_FIELDS,
  EXCEL_REQUIRED_FIELDS,
} from "@/lib/excel-template-types";
import type { ExtractedRowPayload } from "@/lib/pdf-worker";

const FIELD_LABELS: Record<ExcelCanonicalField, string> = {
  product_name: "Product name",
  sales_qty: "Sales qty",
  unit_price: "Unit price (S.P)",
  closing_stock: "Closing stock",
  sales_amount: "Sales amount",
  returns_qty: "Returns qty",
};

type FieldMapState = Partial<Record<ExcelCanonicalField, number | "">>;

type Props = {
  distributorId: string;
  distributorName: string;
  distributorCode: string;
  inputMode: "BOTH" | "EXCEL_ONLY";
  isSetup?: boolean;
  returnTo?: string;
};

export function ExcelTemplateWizard({
  distributorId,
  distributorName,
  distributorCode,
  inputMode,
  isSetup,
  returnTo,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const [sheetName, setSheetName] = useState("");
  const [headerGrid, setHeaderGrid] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<ExtractedRowPayload[]>([]);
  const [fieldMap, setFieldMap] = useState<FieldMapState>({});
  const [excelConfiguredAt, setExcelConfiguredAt] = useState<string | null>(null);

  const loadExisting = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/distributors/${distributorId}/excel-template`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      const cfg = data.activeTemplate?.excelConfig as ExcelTemplateConfig | null;
      setExcelConfiguredAt(data.activeTemplate?.excelConfiguredAt ?? null);
      if (cfg?.fields) {
        setHeaderRow(cfg.headerRow ?? 0);
        setSheetName(cfg.sheetName ?? "");
        const next: FieldMapState = {};
        for (const key of EXCEL_CANONICAL_FIELDS) {
          const col = cfg.fields[key as keyof typeof cfg.fields]?.col;
          if (typeof col === "number") next[key] = col;
        }
        setFieldMap(next);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load Excel template");
    } finally {
      setLoading(false);
    }
  }, [distributorId]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  const buildConfig = useCallback((): ExcelTemplateConfig | null => {
    const fields: ExcelTemplateConfig["fields"] = {
      product_name: { col: -1 },
      sales_qty: { col: -1 },
    };
    for (const key of EXCEL_CANONICAL_FIELDS) {
      const col = fieldMap[key];
      if (typeof col === "number" && col >= 0) {
        (fields as Record<string, { col: number }>)[key] = { col };
      }
    }
    if (fields.product_name.col < 0 || fields.sales_qty.col < 0) return null;
    return {
      source: "excel",
      headerRow,
      ...(sheetName.trim() ? { sheetName: sheetName.trim() } : {}),
      fields,
    };
  }, [fieldMap, headerRow, sheetName]);

  const missingRequired = useMemo(() => {
    return EXCEL_REQUIRED_FIELDS.filter((f) => typeof fieldMap[f] !== "number");
  }, [fieldMap]);

  const missingRecommended = useMemo(() => {
    return EXCEL_RECOMMENDED_FIELDS.filter((f) => typeof fieldMap[f] !== "number");
  }, [fieldMap]);

  const canSave = missingRequired.length === 0;

  async function runPreview(file: File, config?: ExcelTemplateConfig | null) {
    setPreviewing(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("headerRow", String(headerRow));
      if (sheetName.trim()) form.append("sheetName", sheetName.trim());
      if (config) form.append("config", JSON.stringify(config));

      const res = await fetch(`/api/distributors/${distributorId}/excel-template/preview`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");

      setHeaderGrid(data.headerGrid ?? []);
      setPreviewRows(data.previewRows ?? []);
      if (data.sheetName) setSheetName(data.sheetName);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSampleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Select an .xlsx Excel file");
      return;
    }
    setSampleFile(file);
    await runPreview(file, buildConfig());
  }

  async function handleRefreshPreview() {
    if (!sampleFile) {
      toast.error("Upload a sample .xlsx first");
      return;
    }
    await runPreview(sampleFile, buildConfig());
  }

  async function handleSave() {
    const config = buildConfig();
    if (!config) {
      toast.error("Map product_name and sales_qty before saving");
      return;
    }

    if (missingRecommended.length > 0) {
      toast.message(`Recommended fields not mapped: ${missingRecommended.join(", ")}`);
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/distributors/${distributorId}/excel-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      if (data.warnings?.message) {
        toast.message(data.warnings.message);
      }
      toast.success("Excel column map saved");
      setExcelConfiguredAt(data.template?.excelConfiguredAt ?? new Date().toISOString());

      if (returnTo) {
        router.push(returnTo);
      } else if (isSetup) {
        router.push("/distributors");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Excel map — ${distributorName}`}
        description={`Map sales columns for ${distributorCode}. Required: product name + sales qty.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={returnTo || `/distributors/${distributorId}/template`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            {inputMode !== "EXCEL_ONLY" && (
              <Button variant="outline" asChild>
                <Link href={`/distributors/${distributorId}/template`}>PDF template</Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={inputMode === "EXCEL_ONLY" ? "warning" : "secondary"}>
          {inputMode === "EXCEL_ONLY" ? "Excel only" : "PDF + Excel"}
        </Badge>
        {excelConfiguredAt ? (
          <Badge variant="success">Excel map ready</Badge>
        ) : (
          <Badge variant="danger">Excel map required</Badge>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">1. Sample workbook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Header row (0-based)</Label>
              <Input
                type="number"
                min={0}
                value={headerRow}
                onChange={(e) => setHeaderRow(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Sheet name (optional)</Label>
              <Input
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder="First sheet if blank"
              />
            </div>
          </div>
          <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted">
            <Upload className="h-4 w-4" />
            {sampleFile ? sampleFile.name : "Upload sample .xlsx"}
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleSampleChange}
            />
          </label>
          {sampleFile && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={previewing}
              onClick={handleRefreshPreview}
            >
              {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh preview"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">2. Column mapping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {headerGrid.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {headerGrid.map((label, i) => (
                      <th key={i} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                        Col {i}
                        <div className="font-normal text-muted-foreground">{label || "—"}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
              </table>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {EXCEL_CANONICAL_FIELDS.map((field) => {
              const required = (EXCEL_REQUIRED_FIELDS as readonly string[]).includes(field);
              const recommended = (EXCEL_RECOMMENDED_FIELDS as readonly string[]).includes(field);
              return (
                <div key={field} className="space-y-1.5">
                  <Label>
                    {FIELD_LABELS[field]}
                    {required ? (
                      <span className="text-destructive"> *</span>
                    ) : recommended ? (
                      <span className="text-muted-foreground"> (recommended)</span>
                    ) : (
                      <span className="text-muted-foreground"> (optional)</span>
                    )}
                  </Label>
                  <Select
                    value={
                      typeof fieldMap[field] === "number" ? String(fieldMap[field]) : "__none__"
                    }
                    onValueChange={(value) => {
                      setFieldMap((prev) => {
                        const next = { ...prev };
                        if (value === "__none__") delete next[field];
                        else next[field] = Number(value);
                        return next;
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Not mapped —</SelectItem>
                      {(headerGrid.length > 0
                        ? headerGrid
                        : Array.from({ length: 12 }, (_, i) => `Column ${i}`)
                      ).map((label, i) => (
                        <SelectItem key={i} value={String(i)}>
                          Col {i}
                          {headerGrid.length > 0 ? `: ${label || "(empty)"}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>

          {missingRecommended.length > 0 && canSave && (
            <p className="text-sm text-amber-700">
              Recommended fields missing: {missingRecommended.map((f) => FIELD_LABELS[f]).join(", ")}.
              You can still save.
            </p>
          )}
        </CardContent>
      </Card>

      {previewRows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">3. Live preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Unit price</th>
                    <th className="px-3 py-2">Closing</th>
                    <th className="px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-2">{row.raw_product_text}</td>
                      <td className="px-3 py-2">{row.quantity}</td>
                      <td className="px-3 py-2">{row.unit_price ?? "—"}</td>
                      <td className="px-3 py-2">{row.closing_stock ?? "—"}</td>
                      <td className="px-3 py-2">{row.gross_value ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="accent" disabled={!canSave || saving} onClick={handleSave}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Excel map
        </Button>
      </div>
    </div>
  );
}
