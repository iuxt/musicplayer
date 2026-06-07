import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scanMusicFolder, writeEmbeddedArtwork } from "./scanner.js";

describe("scanMusicFolder", () => {
  it("finds supported audio files recursively and ignores unsupported files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "music-scan-"));
    const nested = path.join(root, "Album", "Disc 1");
    await mkdir(nested, { recursive: true });
    await writeFile(path.join(root, "first.mp3"), "not-real-audio");
    await writeFile(path.join(nested, "nested.flac"), "not-real-audio");
    await writeFile(path.join(nested, "notes.txt"), "ignore me");

    const result = await scanMusicFolder(root);

    expect(result.folderPath).toBe(root);
    expect(result.tracks.map((track) => track.title).sort()).toEqual(["first", "nested"]);
    expect(result.tracks.map((track) => track.extension).sort()).toEqual(["flac", "mp3"]);
    expect(result.tracks.every((track) => track.artist === "Unknown Artist")).toBe(true);
    expect(result.tracks.every((track) => track.album === "Unknown Album")).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("includes wav files in the scanned library", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "music-wav-"));
    await writeFile(path.join(root, "sample.wav"), "not-real-audio");

    const result = await scanMusicFolder(root);

    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toMatchObject({
      title: "sample",
      extension: "wav"
    });
  });

  it("discovers sidecar lyrics and artwork near a track", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "music-assets-"));
    const album = path.join(root, "Album");
    await mkdir(album, { recursive: true });
    const trackPath = path.join(album, "song.flac");
    const lyricsPath = path.join(album, "song.lrc");
    const artworkPath = path.join(album, "cover.jpg");
    await writeFile(trackPath, "not-real-audio");
    await writeFile(lyricsPath, "[00:01.00]hello from lyrics");
    await writeFile(artworkPath, "fake image");

    const result = await scanMusicFolder(root);

    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toMatchObject({
      title: "song",
      artworkPath,
      lyricsPath,
      hasLyrics: true
    });
  });

  it("writes embedded artwork to a stable cache file", async () => {
    const trackPath = path.join(await mkdtemp(path.join(os.tmpdir(), "embedded-art-")), "song.mp3");
    await writeFile(trackPath, "not-real-audio");

    const artworkPath = await writeEmbeddedArtwork(trackPath, {
      format: "image/jpeg",
      data: new Uint8Array([1, 2, 3])
    });

    expect(artworkPath).toMatch(/\.jpg$/);
    await expect(readFile(artworkPath)).resolves.toEqual(Buffer.from([1, 2, 3]));
  });
});
