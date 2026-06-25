import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface DesktopLyricsPosition {
  x: number;
  y: number;
}

interface DesktopLyricsSize {
  width: number;
  height: number;
}

interface DesktopLyricsWorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function readDesktopLyricsPosition(filePath: string): Promise<DesktopLyricsPosition | null> {
  try {
    const savedValue = await readFile(filePath, "utf8");
    return normalizeDesktopLyricsPosition(JSON.parse(savedValue) as unknown);
  } catch {
    return null;
  }
}

export async function writeDesktopLyricsPosition(filePath: string, position: DesktopLyricsPosition): Promise<void> {
  const normalizedPosition = normalizeDesktopLyricsPosition(position);
  if (!normalizedPosition) {
    return;
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(normalizedPosition), "utf8");
}

export function clampDesktopLyricsPosition(
  position: DesktopLyricsPosition,
  size: DesktopLyricsSize,
  workArea: DesktopLyricsWorkArea
): DesktopLyricsPosition {
  const normalizedPosition = normalizeDesktopLyricsPosition(position);
  if (!normalizedPosition) {
    return { x: workArea.x, y: workArea.y };
  }

  const width = normalizePositiveSize(size.width);
  const height = normalizePositiveSize(size.height);
  const maxX = Math.max(workArea.x, workArea.x + workArea.width - width);
  const maxY = Math.max(workArea.y, workArea.y + workArea.height - height);

  return {
    x: clamp(normalizedPosition.x, workArea.x, maxX),
    y: clamp(normalizedPosition.y, workArea.y, maxY)
  };
}

function normalizeDesktopLyricsPosition(value: unknown): DesktopLyricsPosition | null {
  if (!isRecord(value)) {
    return null;
  }

  const x = normalizeCoordinate(value.x);
  const y = normalizeCoordinate(value.y);
  if (x === null || y === null) {
    return null;
  }

  return { x, y };
}

function normalizeCoordinate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value);
}

function normalizePositiveSize(value: number) {
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }

  return Math.ceil(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
