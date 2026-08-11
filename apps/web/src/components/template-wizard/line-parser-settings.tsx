"use client";

import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LineParserConfig } from "@/lib/pdf-template-types";
import {
  DEFAULT_LINE_PARSER,
  LINE_PARSER_MODE_LABELS,
} from "@/lib/line-fallback-utils";

interface LineParserSettingsProps {
  value: LineParserConfig;
  onChange: (value: LineParserConfig) => void;
  disabled?: boolean;
}

export function LineParserSettings({ value, onChange, disabled }: LineParserSettingsProps) {
  const mode = value.mode ?? "rate_and_columns";

  function patch(partial: Partial<LineParserConfig>) {
    onChange({ ...DEFAULT_LINE_PARSER, ...value, enabled: true, ...partial });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          This PDF has no detectable table headers. Extraction uses a{" "}
          <strong>line parser</strong> — map which numeric token positions are sales qty and
          amount after the product name and rate.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Parser mode</Label>
        <Select
          value={mode}
          disabled={disabled}
          onValueChange={(v) =>
            patch({ mode: v as LineParserConfig["mode"] })
          }
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

      {(mode === "rate_and_columns" || mode === "trailing_integers") && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sales-qty-col">Sales qty column index</Label>
            <Input
              id="sales-qty-col"
              type="number"
              min={0}
              disabled={disabled}
              value={value.salesQtyColumn ?? ""}
              onChange={(e) =>
                patch({ salesQtyColumn: Math.max(0, parseInt(e.target.value, 10) || 0) })
              }
            />
            <p className="text-xs text-muted-foreground">
              0-based index into numeric tokens after the rate (e.g. net sale qty).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sales-amt-col">Sales amount column index</Label>
            <Input
              id="sales-amt-col"
              type="number"
              min={0}
              disabled={disabled}
              value={value.salesAmountColumn ?? ""}
              onChange={(e) =>
                patch({
                  salesAmountColumn: Math.max(0, parseInt(e.target.value, 10) || 0),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              0-based index for net sale value amount.
            </p>
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
          <Label htmlFor="min-numeric">Minimum numeric columns</Label>
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
        </div>
      )}

      {mode === "regex" && (
        <div className="space-y-2">
          <Label htmlFor="regex-pattern">Line regex pattern</Label>
          <Input
            id="regex-pattern"
            disabled={disabled}
            value={value.pattern ?? ""}
            placeholder="^(?P&lt;product&gt;.+?)\\s+(?P&lt;unit_price&gt;\\d+\\.\\d{2})..."
            onChange={(e) => patch({ pattern: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Named groups: product, unit_price, sales_qty, sales_amount
          </p>
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
    </div>
  );
}
