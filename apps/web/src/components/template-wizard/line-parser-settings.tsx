"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CanonicalField,
  LineFieldSource,
  LineParserConfig,
  LineParserFieldMappings,
  LineParserPreview,
} from "@/lib/pdf-template-types";
import {
  CANONICAL_FIELDS,
  RECOMMENDED_CANONICAL_FIELDS,
  REQUIRED_CANONICAL_FIELDS,
} from "@/lib/pdf-template-types";
import {
  DEFAULT_LINE_PARSER,
  findFieldMappingConflicts,
  isLineFieldMapped,
  LINE_PARSER_MODE_LABELS,
  resolveLineFieldMappings,
  tokenIndicesForSource,
} from "@/lib/line-fallback-utils";
import { FIELD_LABELS } from "@/lib/template-wizard-state";
import { cn } from "@/lib/utils";

const FIELD_COLORS: Partial<Record<CanonicalField, string>> = {
  product_name: "bg-sky-100 border-sky-400 text-sky-900",
  unit_price: "bg-violet-100 border-violet-400 text-violet-900",
  sales_qty: "bg-emerald-100 border-emerald-400 text-emerald-900",
  sales_amount: "bg-teal-100 border-teal-400 text-teal-900",
  returns_qty: "bg-amber-100 border-amber-400 text-amber-900",
  closing_stock: "bg-orange-100 border-orange-400 text-orange-900",
};

const FIELD_DOT: Partial<Record<CanonicalField, string>> = {
  product_name: "bg-sky-500",
  unit_price: "bg-violet-500",
  sales_qty: "bg-emerald-500",
  sales_amount: "bg-teal-500",
  returns_qty: "bg-amber-500",
  closing_stock: "bg-orange-500",
};

interface LineParserSettingsProps {
  value: LineParserConfig;
  onChange: (value: LineParserConfig) => void;
  disabled?: boolean;
  lineParserPreview?: LineParserPreview | null;
}

function sourceLabel(source: LineFieldSource | undefined, tokens: string[]): string {
  if (!source) return "Ignore";
  switch (source.kind) {
    case "before_rate":
      return "Text before rate (auto)";
    case "rate_pattern":
      return "Rate pattern (auto)";
    case "token_index":
      return tokens[source.index] != null
        ? `Token: ${tokens[source.index]}`
        : `Token #${source.index}`;
    case "token_range": {
      const slice = tokens.slice(source.start, source.end + 1).join(" ");
      return slice ? `Tokens: ${slice}` : `Tokens ${source.start}–${source.end}`;
    }
    case "after_rate_index":
      return `After rate #${source.index}`;
    default:
      return "Ignore";
  }
}

function highlightIndicesForMappings(
  mappings: LineParserFieldMappings,
  tokens: string[],
  ratePattern = String.raw`\d+\.\d{2}`
): Map<number, CanonicalField[]> {
  const map = new Map<number, CanonicalField[]>();
  const rateRe = new RegExp(`^${ratePattern}$`);

  let rateIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (rateRe.test(tokens[i] ?? "")) {
      rateIdx = i;
      break;
    }
  }

  for (const field of CANONICAL_FIELDS) {
    const source = mappings[field];
    if (!source) continue;
    let indices: number[] = [];
    if (source.kind === "before_rate" && rateIdx > 0) {
      indices = Array.from({ length: rateIdx }, (_, i) => i);
    } else if (source.kind === "rate_pattern" && rateIdx >= 0) {
      indices = [rateIdx];
    } else if (source.kind === "after_rate_index" && rateIdx >= 0) {
      const numericAfter: number[] = [];
      for (let i = rateIdx + 1; i < tokens.length; i++) {
        const t = tokens[i] ?? "";
        if (t === "-" || /^-?\d[\d,]*(?:\.\d+)?$/.test(t)) numericAfter.push(i);
      }
      if (source.index >= 0 && source.index < numericAfter.length) {
        indices = [numericAfter[source.index]!];
      }
    } else {
      indices = tokenIndicesForSource(source);
    }
    for (const idx of indices) {
      const list = map.get(idx) ?? [];
      list.push(field);
      map.set(idx, list);
    }
  }
  return map;
}

export function LineParserSettings({
  value,
  onChange,
  disabled,
  lineParserPreview,
}: LineParserSettingsProps) {
  const mode = value.mode ?? "rate_and_columns";
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [activeField, setActiveField] = useState<CanonicalField>("sales_qty");
  const [rangeAnchor, setRangeAnchor] = useState<number | null>(null);

  const mappings = useMemo(
    () => resolveLineFieldMappings(value),
    [value]
  );

  const sampleTokens = lineParserPreview?.tokenizedSamples?.[0] ?? [];
  const sampleLines = lineParserPreview?.sampleLines ?? [];
  const highlightMap = useMemo(
    () => highlightIndicesForMappings(mappings, sampleTokens, value.ratePattern),
    [mappings, sampleTokens, value.ratePattern]
  );
  const conflicts = useMemo(() => findFieldMappingConflicts(mappings), [mappings]);

  function patch(partial: Partial<LineParserConfig>) {
    onChange({ ...DEFAULT_LINE_PARSER, ...value, enabled: true, ...partial });
  }

  function setFieldMappings(next: LineParserFieldMappings) {
    patch({ fieldMappings: next });
  }

  function setFieldSource(field: CanonicalField, source: LineFieldSource | undefined) {
    const next: LineParserFieldMappings = { ...mappings };
    if (!source) {
      delete next[field];
    } else {
      next[field] = source;
    }
    setFieldMappings(next);
  }

  function assignTokenToActiveField(index: number, shiftKey: boolean) {
    if (disabled) return;
    if (activeField === "product_name") {
      if (shiftKey && rangeAnchor != null) {
        const start = Math.min(rangeAnchor, index);
        const end = Math.max(rangeAnchor, index);
        setFieldSource("product_name", { kind: "token_range", start, end });
        setRangeAnchor(null);
        return;
      }
      setRangeAnchor(index);
      setFieldSource("product_name", { kind: "token_range", start: index, end: index });
      return;
    }
    setFieldSource(activeField, { kind: "token_index", index });
  }

  function applySuggested() {
    const suggested = lineParserPreview?.suggestedMappings;
    if (!suggested) return;
    setFieldMappings({ ...mappings, ...suggested });
  }

  const missingRequired = REQUIRED_CANONICAL_FIELDS.filter(
    (f) => !isLineFieldMapped(mappings[f])
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          This PDF has no detectable table headers. Click tokens on a sample line to assign{" "}
          <strong>Product Name</strong>, <strong>Sales Units</strong>, and{" "}
          <strong>Sales Value</strong> (and optional Closing Stock / Returns).
        </p>
      </div>

      <div className="space-y-2">
        <Label>Parser mode</Label>
        <Select
          value={mode}
          disabled={disabled}
          onValueChange={(v) => patch({ mode: v as LineParserConfig["mode"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(LINE_PARSER_MODE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode !== "regex" && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Token mapping</p>
            {lineParserPreview?.suggestedMappings && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={applySuggested}
              >
                Apply suggested mappings
              </Button>
            )}
          </div>

          {sampleLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Upload a sample PDF to see product-line tokens you can map.
            </p>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Sample line</p>
                <p className="rounded border bg-background px-2 py-1 font-mono text-xs leading-relaxed">
                  {sampleLines[0]}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {sampleTokens.map((token, index) => {
                  const fields = highlightMap.get(index) ?? [];
                  const primary = fields[0];
                  const conflict = fields.length > 1;
                  return (
                    <button
                      key={`${index}-${token}`}
                      type="button"
                      title={`Token ${index}${fields.length ? ` → ${fields.map((f) => FIELD_LABELS[f]).join(", ")}` : ""}`}
                      disabled={disabled}
                      onClick={(e) => assignTokenToActiveField(index, e.shiftKey)}
                      className={cn(
                        "rounded-md border px-2 py-1 font-mono text-xs transition-colors",
                        primary && !conflict && FIELD_COLORS[primary],
                        conflict && "border-destructive bg-destructive/10 text-destructive",
                        !primary && "border-border bg-background hover:bg-muted",
                        disabled && "opacity-50"
                      )}
                    >
                      <span className="mr-1 text-[10px] text-muted-foreground">{index}</span>
                      {token}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Select a field below, then click a token. For Product Name, click once for a single
                token or Shift+click a second token for a range.
              </p>
            </>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {CANONICAL_FIELDS.map((field) => {
              const source = mappings[field];
              const required = (REQUIRED_CANONICAL_FIELDS as readonly string[]).includes(field);
              const recommended = (RECOMMENDED_CANONICAL_FIELDS as readonly string[]).includes(
                field
              );
              const isActive = activeField === field;
              return (
                <div
                  key={field}
                  className={cn(
                    "space-y-1.5 rounded-md border p-2",
                    isActive && "border-primary ring-1 ring-primary/30"
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 text-left text-sm font-medium"
                    onClick={() => setActiveField(field)}
                    disabled={disabled}
                  >
                    <span className={cn("h-2.5 w-2.5 rounded-full", FIELD_DOT[field])} />
                    {FIELD_LABELS[field]}
                    {required && (
                      <Badge variant="danger" className="ml-auto text-[10px]">
                        Required
                      </Badge>
                    )}
                    {!required && recommended && field === "closing_stock" && (
                      <Badge variant="warning" className="ml-auto text-[10px]">
                        Recommended
                      </Badge>
                    )}
                  </button>

                  <Select
                    value={
                      !source
                        ? "ignore"
                        : source.kind === "before_rate"
                          ? "before_rate"
                          : source.kind === "rate_pattern"
                            ? "rate_pattern"
                            : source.kind === "after_rate_index"
                              ? `after:${source.index}`
                              : source.kind === "token_range"
                                ? `range:${source.start}:${source.end}`
                                : source.kind === "token_index"
                                  ? `token:${source.index}`
                                  : "ignore"
                    }
                    disabled={disabled}
                    onValueChange={(v) => {
                      setActiveField(field);
                      if (v === "ignore") {
                        setFieldSource(field, undefined);
                      } else if (v === "before_rate") {
                        setFieldSource(field, { kind: "before_rate" });
                      } else if (v === "rate_pattern") {
                        setFieldSource(field, { kind: "rate_pattern" });
                      } else if (v.startsWith("after:")) {
                        setFieldSource(field, {
                          kind: "after_rate_index",
                          index: parseInt(v.slice(6), 10),
                        });
                      } else if (v.startsWith("token:")) {
                        setFieldSource(field, {
                          kind: "token_index",
                          index: parseInt(v.slice(6), 10),
                        });
                      } else if (v.startsWith("range:")) {
                        const [, start, end] = v.split(":");
                        setFieldSource(field, {
                          kind: "token_range",
                          start: parseInt(start!, 10),
                          end: parseInt(end!, 10),
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Map field…">
                        {sourceLabel(source, sampleTokens)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {!required && <SelectItem value="ignore">Ignore</SelectItem>}
                      {field === "product_name" && (
                        <SelectItem value="before_rate">Text before rate (auto)</SelectItem>
                      )}
                      {field === "unit_price" && (
                        <SelectItem value="rate_pattern">Rate pattern (auto)</SelectItem>
                      )}
                      {source?.kind === "token_range" && (
                        <SelectItem value={`range:${source.start}:${source.end}`}>
                          {sourceLabel(source, sampleTokens)}
                        </SelectItem>
                      )}
                      {source?.kind === "after_rate_index" && (
                        <SelectItem value={`after:${source.index}`}>
                          After rate #{source.index}
                        </SelectItem>
                      )}
                      {sampleTokens.map((token, index) => (
                        <SelectItem key={index} value={`token:${index}`}>
                          [{index}] {token}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>

          {missingRequired.length > 0 && (
            <p className="text-sm text-destructive">
              Map required fields: {missingRequired.map((f) => FIELD_LABELS[f]).join(", ")}
            </p>
          )}
          {conflicts.length > 0 && (
            <p className="text-sm text-amber-700">
              Warning: token {conflicts.map((c) => c.index).join(", ")} assigned to multiple
              fields.
            </p>
          )}
        </div>
      )}

      {mode === "regex" && (
        <div className="space-y-2">
          <Label htmlFor="regex-pattern">Line regex pattern</Label>
          <Input
            id="regex-pattern"
            disabled={disabled}
            value={value.pattern ?? ""}
            placeholder="Named groups: product, unit_price, sales_qty, sales_amount"
            onChange={(e) => patch({ pattern: e.target.value })}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.treatDashAsZero ?? true}
            disabled={disabled}
            onChange={(e) => patch({ treatDashAsZero: e.target.checked })}
          />
          Treat &quot;-&quot; as zero
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.codePrefix ?? false}
            disabled={disabled}
            onChange={(e) => patch({ codePrefix: e.target.checked })}
          />
          Product line has numeric code prefix
        </label>
      </div>

      <div className="rounded-lg border">
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium"
          onClick={() => setAdvancedOpen((o) => !o)}
        >
          {advancedOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Advanced
        </button>
        {advancedOpen && (
          <div className="space-y-3 border-t px-3 py-3">
            {(mode === "rate_and_columns" || mode === "trailing_integers") && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sales-qty-col">Legacy sales qty after-rate index</Label>
                  <Input
                    id="sales-qty-col"
                    type="number"
                    min={0}
                    disabled={disabled}
                    value={value.salesQtyColumn ?? ""}
                    onChange={(e) =>
                      patch({
                        salesQtyColumn: Math.max(0, parseInt(e.target.value, 10) || 0),
                        fieldMappings: {
                          ...mappings,
                          sales_qty: {
                            kind: "after_rate_index",
                            index: Math.max(0, parseInt(e.target.value, 10) || 0),
                          },
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sales-amt-col">Legacy sales amount after-rate index</Label>
                  <Input
                    id="sales-amt-col"
                    type="number"
                    min={0}
                    disabled={disabled}
                    value={value.salesAmountColumn ?? ""}
                    onChange={(e) =>
                      patch({
                        salesAmountColumn: Math.max(0, parseInt(e.target.value, 10) || 0),
                        fieldMappings: {
                          ...mappings,
                          sales_amount: {
                            kind: "after_rate_index",
                            index: Math.max(0, parseInt(e.target.value, 10) || 0),
                          },
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}

            {mode === "trailing_integers" && (
              <div className="space-y-2">
                <Label htmlFor="trailing-count">Trailing numeric count</Label>
                <Input
                  id="trailing-count"
                  type="number"
                  min={1}
                  disabled={disabled}
                  value={value.trailingNumericCount ?? ""}
                  onChange={(e) =>
                    patch({
                      trailingNumericCount: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                />
              </div>
            )}

            {mode === "rate_and_columns" && (
              <div className="space-y-2">
                <Label htmlFor="min-numeric">Minimum numeric / token columns</Label>
                <Input
                  id="min-numeric"
                  type="number"
                  min={1}
                  disabled={disabled}
                  value={value.minNumericColumns ?? ""}
                  onChange={(e) =>
                    patch({
                      minNumericColumns: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Legacy: minimum numeric tokens after the rate. With absolute token mappings,
                  also acts as a minimum token count override.
                </p>
              </div>
            )}

            {mode === "pipe_table" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Product column</Label>
                  <Input
                    type="number"
                    min={0}
                    disabled={disabled}
                    value={value.productColumn ?? ""}
                    onChange={(e) =>
                      patch({
                        productColumn: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rate column</Label>
                  <Input
                    type="number"
                    min={0}
                    disabled={disabled}
                    value={value.rateColumn ?? ""}
                    onChange={(e) =>
                      patch({ rateColumn: Math.max(0, parseInt(e.target.value, 10) || 0) })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
