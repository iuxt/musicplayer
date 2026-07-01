import { mkdtemp, mkdir, readFile, readdir, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanupArtworkCache, scanMusicFolder, writeEmbeddedArtwork } from "./scanner.js";

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
    expect(result.tracks.every((track) => track.artist === "未知歌手")).toBe(true);
    expect(result.tracks.every((track) => track.album === "未知专辑")).toBe(true);
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

  it("reads m3u playlists from the playlists folder", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "music-m3u-"));
    const playlistsFolder = path.join(root, "playlists");
    const albumFolder = path.join(root, "Album");
    await mkdir(playlistsFolder, { recursive: true });
    await mkdir(albumFolder, { recursive: true });
    const firstTrackPath = path.join(root, "first.mp3");
    const secondTrackPath = path.join(albumFolder, "second.flac");
    const playlistPath = path.join(playlistsFolder, "90后.m3u");
    await writeFile(firstTrackPath, "not-real-audio");
    await writeFile(secondTrackPath, "not-real-audio");
    await writeFile(
      playlistPath,
      ["#EXTM3U", "#EXTINF:180,Second", "../Album/second.flac", "../missing.mp3", "https://example.com/radio.mp3", "../first.mp3"].join("\n")
    );

    const result = await scanMusicFolder(root);
    const trackIdsByPath = new Map(result.tracks.map((track) => [track.filePath, track.id]));

    expect((result as { playlists?: Array<{ name: string; filePath: string; trackIds: string[] }> }).playlists).toEqual([
      {
        id: expect.any(String),
        name: "90后",
        filePath: playlistPath,
        trackIds: [trackIdsByPath.get(secondTrackPath), trackIdsByPath.get(firstTrackPath)]
      }
    ]);
  });

  it("matches sidecar lyrics without requiring identical filename casing", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "music-lyrics-case-"));
    await writeFile(path.join(root, "Song.flac"), "not-real-audio");
    const lyricsPath = path.join(root, "song.lrc");
    await writeFile(lyricsPath, "[00:01.00]case-insensitive lyrics");

    const result = await scanMusicFolder(root);

    expect(result.tracks[0]).toMatchObject({
      title: "Song",
      lyricsPath,
      hasLyrics: true
    });
  });

  it("coalesces scan progress for large folders", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "music-progress-"));
    await Promise.all(
      Array.from({ length: 100 }, (_, index) => writeFile(path.join(root, `track-${index}.mp3`), "not-real-audio"))
    );
    let progressCount = 0;

    const result = await scanMusicFolder(root, {
      onProgress: () => {
        progressCount += 1;
      }
    });

    expect(result.tracks).toHaveLength(100);
    expect(progressCount).toBeLessThan(25);
  });

  it("writes embedded artwork to a stable cache file", async () => {
    const trackPath = path.join(await mkdtemp(path.join(os.tmpdir(), "embedded-art-")), "song.mp3");
    await writeFile(trackPath, "not-real-audio");

    const artworkPath = await writeEmbeddedArtwork(trackPath, {
      format: "image/jpeg",
      data: new Uint8Array([1, 2, 3])
    });

    expect(artworkPath).not.toBeNull();
    expect(artworkPath!).toMatch(/\.jpg$/);
    await expect(readFile(artworkPath!)).resolves.toEqual(Buffer.from([1, 2, 3]));
  });

  it("writes embedded artwork into a configured cache directory", async () => {
    const trackPath = path.join(await mkdtemp(path.join(os.tmpdir(), "embedded-art-custom-")), "song.mp3");
    const artworkCacheDir = await mkdtemp(path.join(os.tmpdir(), "musicplayer-artwork-cache-"));

    const artworkPath = await writeEmbeddedArtwork(
      trackPath,
      {
        format: "image/png",
        data: new Uint8Array([4, 5, 6])
      },
      artworkCacheDir
    );

    expect(artworkPath).not.toBeNull();
    expect(path.dirname(artworkPath!)).toBe(artworkCacheDir);
    expect(artworkPath!).toMatch(/\.png$/);
    await expect(readFile(artworkPath!)).resolves.toEqual(Buffer.from([4, 5, 6]));
  });

  it("does not rewrite unchanged embedded artwork cache files", async () => {
    const trackPath = path.join(await mkdtemp(path.join(os.tmpdir(), "embedded-art-stable-")), "song.mp3");
    const artworkCacheDir = await mkdtemp(path.join(os.tmpdir(), "musicplayer-artwork-stable-"));
    const artworkPath = await writeEmbeddedArtwork(
      trackPath,
      {
        format: "image/jpeg",
        data: new Uint8Array([7, 8, 9])
      },
      artworkCacheDir
    );
    expect(artworkPath).not.toBeNull();
    const oldTimestamp = new Date("2024-01-01T00:00:00.000Z");
    await utimes(artworkPath!, oldTimestamp, oldTimestamp);

    await writeEmbeddedArtwork(
      trackPath,
      {
        format: "image/jpeg",
        data: new Uint8Array([7, 8, 9])
      },
      artworkCacheDir
    );

    expect((await stat(artworkPath!)).mtime.getTime()).toBe(oldTimestamp.getTime());
  });

  it("skips embedded artwork that exceeds the configured size limit", async () => {
    const trackPath = path.join(await mkdtemp(path.join(os.tmpdir(), "embedded-art-large-")), "song.mp3");
    const artworkCacheDir = await mkdtemp(path.join(os.tmpdir(), "musicplayer-artwork-large-"));

    const artworkPath = await writeEmbeddedArtwork(
      trackPath,
      {
        format: "image/jpeg",
        data: new Uint8Array([1, 2, 3, 4])
      },
      { cacheDir: artworkCacheDir, maxBytes: 3 }
    );

    expect(artworkPath).toBeNull();
    expect(await readdir(artworkCacheDir)).toEqual([]);
  });

  it("removes stale embedded artwork cache files after a scan", async () => {
    const artworkCacheDir = await mkdtemp(path.join(os.tmpdir(), "musicplayer-artwork-clean-"));
    const currentArtworkPath = path.join(artworkCacheDir, "current.jpg");
    const staleArtworkPath = path.join(artworkCacheDir, "stale.jpg");
    await writeFile(currentArtworkPath, "current");
    await writeFile(staleArtworkPath, "stale");

    await cleanupArtworkCache(artworkCacheDir, new Set([currentArtworkPath]));

    await expect(readFile(currentArtworkPath, "utf8")).resolves.toBe("current");
    await expect(readFile(staleArtworkPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
