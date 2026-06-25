// @vitest-environment node

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  clampDesktopLyricsPosition,
  readDesktopLyricsPosition,
  writeDesktopLyricsPosition
} from "./desktopLyricsPosition.js";

const tempDirs: string[] = [];

describe("desktopLyricsPosition", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("reads a valid persisted desktop lyrics position", async () => {
    const filePath = path.join(await makeTempDir(), "position.json");
    await writeFile(filePath, JSON.stringify({ x: 120.4, y: -49.6, width: 999 }), "utf8");

    await expect(readDesktopLyricsPosition(filePath)).resolves.toEqual({ x: 120, y: -50 });
  });

  it("ignores missing, malformed, and invalid persisted positions", async () => {
    const root = await makeTempDir();

    await expect(readDesktopLyricsPosition(path.join(root, "missing.json"))).resolves.toBeNull();

    const malformedPath = path.join(root, "malformed.json");
    await writeFile(malformedPath, "not-json", "utf8");
    await expect(readDesktopLyricsPosition(malformedPath)).resolves.toBeNull();

    const invalidPath = path.join(root, "invalid.json");
    await writeFile(invalidPath, JSON.stringify({ x: "120", y: 50 }), "utf8");
    await expect(readDesktopLyricsPosition(invalidPath)).resolves.toBeNull();
  });

  it("writes a normalized desktop lyrics position and creates the parent directory", async () => {
    const filePath = path.join(await makeTempDir(), "nested", "position.json");

    await writeDesktopLyricsPosition(filePath, { x: 12.6, y: 44.2 });

    await expect(readFile(filePath, "utf8").then(JSON.parse)).resolves.toEqual({ x: 13, y: 44 });
  });

  it("clamps a restored position to the visible work area", () => {
    expect(
      clampDesktopLyricsPosition(
        { x: 950, y: -30 },
        { width: 200, height: 100 },
        { x: 100, y: 50, width: 800, height: 600 }
      )
    ).toEqual({ x: 700, y: 50 });
  });
});

async function makeTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "desktop-lyrics-position-"));
  tempDirs.push(dir);
  return dir;
}
