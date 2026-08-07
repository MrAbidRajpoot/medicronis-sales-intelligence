import JSZip from "jszip";

export interface ExtractedUploadFile {
  name: string;
  buffer: Buffer;
}

export async function expandUploadFiles(files: File[]): Promise<ExtractedUploadFile[]> {
  const result: ExtractedUploadFile[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const lower = file.name.toLowerCase();

    if (lower.endsWith(".zip")) {
      const zip = await JSZip.loadAsync(buffer);
      const entries = Object.values(zip.files).filter(
        (entry) => !entry.dir && entry.name.toLowerCase().endsWith(".pdf")
      );

      for (const entry of entries) {
        const pdfBuffer = await entry.async("nodebuffer");
        const name = entry.name.split(/[/\\]/).pop() ?? entry.name;
        result.push({ name, buffer: pdfBuffer });
      }
    } else if (lower.endsWith(".pdf")) {
      result.push({ name: file.name, buffer });
    }
  }

  return result;
}
