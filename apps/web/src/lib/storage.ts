import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

function resolveUploadDir(): string {
  if (process.env.UPLOAD_DIR) {
    const configured = process.env.UPLOAD_DIR;
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
  }
  // Vercel serverless: filesystem is read-only except /tmp
  if (process.env.VERCEL) {
    return "/tmp/medicronis-uploads";
  }
  return path.resolve(process.cwd(), "..", "..", "uploads");
}

export function getUploadDir(): string {
  return resolveUploadDir();
}

export async function saveUploadedFile(
  buffer: Buffer,
  originalName: string
): Promise<{ filePath: string; fileHash: string; fileSize: number }> {
  const uploadDir = getUploadDir();
  await mkdir(uploadDir, { recursive: true });

  const fileHash = createHash("sha256").update(buffer).digest("hex");
  const ext = path.extname(originalName) || ".pdf";
  const storedName = `${fileHash.slice(0, 16)}_${Date.now()}${ext}`;
  const filePath = path.join(uploadDir, storedName);

  await writeFile(filePath, buffer);

  return { filePath, fileHash, fileSize: buffer.length };
}

export function fileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
