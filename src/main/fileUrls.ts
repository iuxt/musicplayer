import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function toMediaFileUrl(filePath: string): string {
  if (!filePath.trim()) {
    throw new Error("filePath is required");
  }

  return pathToFileURL(filePath).toString();
}

export function toOptionalFileUrl(filePath: string | null): string | null {
  return filePath ? toMediaFileUrl(filePath) : null;
}

export async function readLyricsFile(filePath: string | null): Promise<string | null> {
  if (!filePath) {
    return null;
  }

  return readFile(filePath, "utf8");
}
