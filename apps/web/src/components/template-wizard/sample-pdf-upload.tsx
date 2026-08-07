"use client";

import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SamplePdfUploadProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

export function SamplePdfUpload({ file, onFileChange, disabled }: SamplePdfUploadProps) {
  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    if (picked && !picked.name.toLowerCase().endsWith(".pdf")) return;
    onFileChange(picked);
  }

  return (
    <div className="space-y-3">
      <Label>Sample PDF</Label>
      <div
        className={cn(
          "flex min-h-[140px] flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 transition-colors",
          disabled ? "opacity-60" : "hover:border-primary/50"
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Upload a representative sales report PDF</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Used to detect headers and preview extraction
        </p>
        <label className="mt-4">
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            disabled={disabled}
            onChange={handleInput}
          />
          <Button type="button" variant="outline" size="sm" disabled={disabled} asChild>
            <span>Browse PDF</span>
          </Button>
        </label>
      </div>

      {file && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={disabled}
            onClick={() => onFileChange(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
