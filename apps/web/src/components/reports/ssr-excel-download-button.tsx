"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { toast } from "@/components/toast-provider";

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf8 = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, ""));
    } catch {
      return utf8[1].trim().replace(/^"|"$/g, "");
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted?.[1]) return quoted[1];
  const plain = /filename=([^;]+)/i.exec(header);
  if (plain?.[1]) return plain[1].trim().replace(/^"|"$/g, "");
  return fallback;
}

export async function downloadSsrExcel(reportId: string): Promise<void> {
  const res = await fetch(`/api/reports/${reportId}/download?format=xlsx`);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Download failed");
  }
  const blob = await res.blob();
  const fileName = filenameFromDisposition(
    res.headers.get("Content-Disposition"),
    `SSR-${reportId}.xlsx`
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function SsrExcelDownloadButton({
  reportId,
  variant = "accent",
  size = "sm",
  label = "Download Excel",
  iconOnly = false,
}: {
  reportId: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  label?: string;
  iconOnly?: boolean;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleClick() {
    setDownloading(true);
    try {
      await downloadSsrExcel(reportId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={downloading}
      title="Download Excel"
    >
      {downloading ? (
        <Loader2 className={iconOnly ? "h-4 w-4 animate-spin" : "mr-2 h-4 w-4 animate-spin"} />
      ) : (
        <Download className={iconOnly ? "h-4 w-4" : "mr-2 h-4 w-4"} />
      )}
      {!iconOnly && (downloading ? "Downloading…" : label)}
    </Button>
  );
}
