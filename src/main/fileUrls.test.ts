import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readLyricsFile, toMediaFileUrl, toOptionalFileUrl } from "./fileUrls.js";

describe("toMediaFileUrl", () => {
  it("encodes local file paths as file URLs", () => {
    const filePath = path.join(path.sep, "Music Library", "A Song.mp3");

    expect(toMediaFileUrl(filePath)).toContain("A%20Song.mp3");
    expect(toMediaFileUrl(filePath)).toMatch(/^file:\/\//);
  });

  it("rejects empty paths", () => {
    expect(() => toMediaFileUrl("")).toThrow("filePath is required");
  });

  it("returns null for missing optional file paths", () => {
    expect(toOptionalFileUrl(null)).toBeNull();
  });

  it("reads lyrics files as text", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lyrics-read-"));
    const lyricsPath = path.join(root, "song.lrc");
    await writeFile(lyricsPath, "[00:01.00]hello lyrics", "utf8");

    await expect(readLyricsFile(lyricsPath)).resolves.toBe("[00:01.00]hello lyrics");
  });
});
