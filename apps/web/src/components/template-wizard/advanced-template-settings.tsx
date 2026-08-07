"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PdfPlumberSettings } from "@/lib/pdf-template-types";

interface AdvancedTemplateSettingsProps {
  skipRowsBeforeHeader: number;
  skipRowsContaining: string;
  pdfPlumberSettings: PdfPlumberSettings;
  tableExtractionDisabled: boolean;
  onSkipRowsBeforeHeaderChange: (value: number) => void;
  onSkipRowsContainingChange: (value: string) => void;
  onPdfPlumberSettingsChange: (value: PdfPlumberSettings) => void;
  onTableExtractionDisabledChange: (value: boolean) => void;
  disabled?: boolean;
}

export function AdvancedTemplateSettings({
  skipRowsBeforeHeader,
  skipRowsContaining,
  pdfPlumberSettings,
  tableExtractionDisabled,
  onSkipRowsBeforeHeaderChange,
  onSkipRowsContainingChange,
  onPdfPlumberSettingsChange,
  onTableExtractionDisabledChange,
  disabled,
}: AdvancedTemplateSettingsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/30"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Advanced settings
      </button>

      {open && (
        <div className="space-y-4 border-t px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="skip-rows">Skip rows before header</Label>
              <Input
                id="skip-rows"
                type="number"
                min={0}
                value={skipRowsBeforeHeader}
                disabled={disabled}
                onChange={(e) =>
                  onSkipRowsBeforeHeaderChange(Math.max(0, parseInt(e.target.value, 10) || 0))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skip-containing">Skip rows containing (comma-separated)</Label>
              <Input
                id="skip-containing"
                value={skipRowsContaining}
                disabled={disabled}
                placeholder="TOTAL, GRAND TOTAL"
                onChange={(e) => onSkipRowsContainingChange(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={tableExtractionDisabled}
              disabled={disabled}
              onChange={(e) => onTableExtractionDisabledChange(e.target.checked)}
            />
            Disable table extraction (line parser fallback — Family J)
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>pdfplumber vertical strategy</Label>
              <Input
                value={pdfPlumberSettings.vertical_strategy ?? ""}
                disabled={disabled}
                placeholder="lines_strict"
                onChange={(e) =>
                  onPdfPlumberSettingsChange({
                    ...pdfPlumberSettings,
                    vertical_strategy: e.target.value || undefined,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>pdfplumber horizontal strategy</Label>
              <Input
                value={pdfPlumberSettings.horizontal_strategy ?? ""}
                disabled={disabled}
                placeholder="lines_strict"
                onChange={(e) =>
                  onPdfPlumberSettingsChange({
                    ...pdfPlumberSettings,
                    horizontal_strategy: e.target.value || undefined,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Snap tolerance</Label>
              <Input
                type="number"
                step="0.1"
                value={pdfPlumberSettings.snap_tolerance ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  onPdfPlumberSettingsChange({
                    ...pdfPlumberSettings,
                    snap_tolerance: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Join tolerance</Label>
              <Input
                type="number"
                step="0.1"
                value={pdfPlumberSettings.join_tolerance ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  onPdfPlumberSettingsChange({
                    ...pdfPlumberSettings,
                    join_tolerance: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
