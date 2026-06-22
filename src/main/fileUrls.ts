import { access, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function toMediaFileUrl(filePath: string): string {
  if (!filePath.trim()) {
    throw new Error("缺少文件路径");
  }

  return pathToFileURL(filePath).toString();
}

export function toOptionalFileUrl(filePath: string | null): string | null {
  return filePath ? toMediaFileUrl(filePath) : null;
}

export async function toExistingOptionalFileUrl(filePath: string | null): Promise<string | null> {
  if (!filePath) {
    return null;
  }

  try {
    await access(filePath);
  } catch {
    return null;
  }

  return toMediaFileUrl(filePath);
}

export async function readLyricsFile(filePath: string | null): Promise<string | null> {
  if (!filePath) {
    return null;
  }

  return readFile(filePath, "utf8");
}
