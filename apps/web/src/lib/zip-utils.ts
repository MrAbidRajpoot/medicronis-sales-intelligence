import JSZip from "jszip";

export type UploadFileKind = "pdf" | "xlsx";

export interface ExtractedUploadFile {
  name: string;
  buffer: Buffer;
  kind: UploadFileKind;
  /** True when this file came from a ZIP archive. */
  fromZip?: boolean;
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function isXlsxFileName(name: string): boolean {
  return name.toLowerCase().endsWith(".xlsx");
}

export function isPdfFileName(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

export function mimeTypeForUploadKind(kind: UploadFileKind): string {
  return kind === "xlsx" ? XLSX_MIME : "application/pdf";
}

function isJunkZipEntry(entryName: string): boolean {
  const parts = entryName.split(/[/\\]/);
  if (parts.some((p) => p === "__MACOSX")) return true;
  const base = parts[parts.length - 1] ?? entryName;
  if (base === ".DS_Store" || base.startsWith("._")) return true;
  return false;
}

function kindFromFileName(name: string): UploadFileKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".xlsx")) return "xlsx";
  return null;
}

/**
 * Expand uploads into processable files.
 * - .pdf → PDF
 * - .xlsx → Excel (no PDF worker)
 * - .zip → PDFs and Excel (.xlsx) entries (macOS junk skipped)
 */
export async function expandUploadFiles(files: File[]): Promise<ExtractedUploadFile[]> {
  const result: ExtractedUploadFile[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const lower = file.name.toLowerCase();

    if (lower.endsWith(".zip")) {
      const zip = await JSZip.loadAsync(buffer);
      const entries = Object.values(zip.files).filter((entry) => {
        if (entry.dir) return false;
        if (isJunkZipEntry(entry.name)) return false;
        return kindFromFileName(entry.name) !== null;
      });

      for (const entry of entries) {
        const name = entry.name.split(/[/\\]/).pop() ?? entry.name;
        const kind = kindFromFileName(name);
        if (!kind) continue;
        const entryBuffer = await entry.async("nodebuffer");
        result.push({ name, buffer: entryBuffer, kind, fromZip: true });
      }
    } else if (lower.endsWith(".pdf")) {
      result.push({ name: file.name, buffer, kind: "pdf" });
    } else if (lower.endsWith(".xlsx")) {
      result.push({ name: file.name, buffer, kind: "xlsx" });
    }
  }

  return result;
}
