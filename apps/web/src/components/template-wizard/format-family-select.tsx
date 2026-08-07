"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { HeaderStructure, TemplateConfig } from "@/lib/pdf-template-types";

export interface PdfFormatOption {
  id: string;
  code: string;
  name: string;
  family: string;
  headerStructure: HeaderStructure;
  defaultConfig: TemplateConfig;
}

interface FormatFamilySelectProps {
  formats: PdfFormatOption[];
  value: string;
  suggestedCode?: string | null;
  confidence?: number | null;
  onChange: (formatId: string) => void;
  disabled?: boolean;
}

export function FormatFamilySelect({
  formats,
  value,
  suggestedCode,
  confidence,
  onChange,
  disabled,
}: FormatFamilySelectProps) {
  const suggested = formats.find((f) => f.code === suggestedCode);

  return (
    <div className="space-y-2">
      <Label>Format family (A–J)</Label>
      {suggested && (
        <p className="text-xs text-muted-foreground">
          Suggested: <span className="font-medium text-foreground">{suggested.family}</span>
          {confidence != null && ` (${Math.round(confidence * 100)}% confidence)`}
        </p>
      )}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Select PDF format family" />
        </SelectTrigger>
        <SelectContent>
          {formats.map((format) => (
            <SelectItem key={format.id} value={format.id}>
              Family {format.family} — {format.name}
              {format.code === suggestedCode ? " (suggested)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
