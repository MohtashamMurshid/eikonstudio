import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { decodeDataUrl, mimeTypeToExtension } from "@eikon/sdk";

function extToMimeType(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "image/png";
  }
}

export async function imageFileToDataUrl(filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  const mimeType = extToMimeType(path.extname(filePath));
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function makeOutputPath(
  outputDirectory: string,
  prompt: string,
  explicitPath?: string,
  extensionHint?: string
): string {
  if (explicitPath) return explicitPath;
  const promptSlug = sanitizeSegment(prompt) || "image";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const extension = extensionHint || "png";
  return path.join(outputDirectory, `${stamp}-${promptSlug}.${extension}`);
}

export async function saveDataUrlToFile(dataUrl: string, outputPath: string): Promise<string> {
  const decoded = decodeDataUrl(dataUrl);
  const resolvedExtension = path.extname(outputPath)
    ? outputPath
    : `${outputPath}.${mimeTypeToExtension(decoded.mimeType)}`;

  await mkdir(path.dirname(resolvedExtension), { recursive: true });
  await writeFile(resolvedExtension, decoded.bytes);
  return resolvedExtension;
}
