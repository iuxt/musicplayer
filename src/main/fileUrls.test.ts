import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readLyricsFile, toExistingOptionalFileUrl, toMediaFileUrl, toOptionalFileUrl } from "./fileUrls.js";

describe("toMediaFileUrl", () => {
  it("encodes local file paths as file URLs", () => {
    const filePath = path.join(path.sep, "Music Library", "A Song.mp3");

    expect(toMediaFileUrl(filePath)).toContain("A%20Song.mp3");
    expect(toMediaFileUrl(filePath)).toMatch(/^file:\/\//);
  });

  it("rejects empty paths", () => {
    expect(() => toMediaFileUrl("")).toThrow("缺少文件路径");
  });

  it("returns null for missing optional file paths", () => {
    expect(toOptionalFileUrl(null)).toBeNull();
  });

  it("returns null for optional file paths that no longer exist", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "missing-artwork-"));
    const missingPath = path.join(root, "cover.jpg");

    await expect(toExistingOptionalFileUrl(missingPath)).resolves.toBeNull();
  });

  it("reads lyrics files as text", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lyrics-read-"));
    const lyricsPath = path.join(root, "song.lrc");
    await writeFile(lyricsPath, "[00:01.00]hello lyrics", "utf8");

    await expect(readLyricsFile(lyricsPath)).resolves.toBe("[00:01.00]hello lyrics");
  });
});
