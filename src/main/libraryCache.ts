import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ScanResult } from "../shared/types.js";

export async function readLibraryCacheFile(cachePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(cachePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

export async function writeLibraryCacheFile(cachePath: string, result: ScanResult): Promise<void> {
  await mkdir(path.dirname(cachePath), { recursive: true });
  const temporaryPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;

  try {
    await writeFile(temporaryPath, JSON.stringify(result), "utf8");
    await rename(temporaryPath, cachePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function clearLibraryCacheFile(cachePath: string): Promise<void> {
  await rm(cachePath, { force: true });
}
