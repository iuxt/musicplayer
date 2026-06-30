import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ScanResult } from "../shared/types.js";
import { clearLibraryCacheFile, readLibraryCacheFile, writeLibraryCacheFile } from "./libraryCache.js";

describe("library cache file", () => {
  it("writes and reads scan results from an app data file", async () => {
    const cachePath = path.join(await mkdtemp(path.join(os.tmpdir(), "music-cache-")), "library-cache.json");
    const result = makeScanResult("/Users/test/Music");

    await writeLibraryCacheFile(cachePath, result);

    await expect(readLibraryCacheFile(cachePath)).resolves.toEqual(result);
  });

  it("returns null for missing or corrupt cache files", async () => {
    const cacheDir = await mkdtemp(path.join(os.tmpdir(), "music-cache-corrupt-"));
    const missingPath = path.join(cacheDir, "missing.json");
    const corruptPath = path.join(cacheDir, "library-cache.json");
    await writeFile(corruptPath, "{not json", "utf8");

    await expect(readLibraryCacheFile(missingPath)).resolves.toBeNull();
    await expect(readLibraryCacheFile(corruptPath)).resolves.toBeNull();
  });

  it("clears the cache file without failing when it is already absent", async () => {
    const cachePath = path.join(await mkdtemp(path.join(os.tmpdir(), "music-cache-clear-")), "library-cache.json");
    await writeLibraryCacheFile(cachePath, makeScanResult("/Users/test/Music"));

    await clearLibraryCacheFile(cachePath);
    await clearLibraryCacheFile(cachePath);

    await expect(readFile(cachePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});

function makeScanResult(folderPath: string): ScanResult {
  return {
    folderPath,
    warnings: [],
    playlists: [],
    tracks: [
      {
        id: "track-1",
        filePath: `${folderPath}/Song.wav`,
        title: "Song",
        artist: "Artist",
        album: "Album",
        duration: 180,
        trackNumber: null,
        extension: "wav",
        artworkId: null,
        artworkPath: null,
        lyricsPath: null,
        hasLyrics: false,
        folderPath: "."
      }
    ]
  };
}
