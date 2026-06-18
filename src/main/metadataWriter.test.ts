import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildFfmpegMetadataArgs,
  normalizeTrackMetadataUpdate,
  resolveFfmpegPath,
  writeTrackMetadata
} from "./metadataWriter.js";

describe("metadata writer", () => {
  it("normalizes editable metadata", () => {
    expect(
      normalizeTrackMetadataUpdate({
        title: "  Title  ",
        artist: "  Artist ",
        album: " Album ",
        trackNumber: 3
      })
    ).toEqual({ title: "Title", artist: "Artist", album: "Album", trackNumber: 3 });
  });

  it("rejects invalid metadata", () => {
    expect(() =>
      normalizeTrackMetadataUpdate({ title: "", artist: "Artist", album: "Album", trackNumber: null })
    ).toThrow("标题不能为空");
    expect(() =>
      normalizeTrackMetadataUpdate({ title: "Title", artist: "Artist", album: "Album", trackNumber: 0 })
    ).toThrow("曲号必须是正整数");
  });

  it("builds ffmpeg stream-copy metadata args", () => {
    expect(
      buildFfmpegMetadataArgs("/music/song.mp3", "/music/.song.tmp.mp3", {
        title: "Title",
        artist: "Artist",
        album: "Album",
        trackNumber: null
      })
    ).toEqual([
      "-y",
      "-i",
      "/music/song.mp3",
      "-map",
      "0",
      "-codec",
      "copy",
      "-metadata",
      "title=Title",
      "-metadata",
      "artist=Artist",
      "-metadata",
      "album=Album",
      "-metadata",
      "track=",
      "/music/.song.tmp.mp3"
    ]);
  });

  it("returns submitted metadata when parse after write cannot read the fake file", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "metadata-write-"));
    const trackPath = path.join(root, "song.mp3");
    await writeFile(trackPath, "not real audio");
    const runner = vi.fn(async (_binary: string, args: string[]) => {
      const outputPath = args[args.length - 1];
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, "rewritten fake audio");
    });

    await expect(
      writeTrackMetadata(trackPath, { title: "Title", artist: "Artist", album: "Album", trackNumber: 7 }, { runner })
    ).resolves.toEqual({
      ok: true,
      metadata: { title: "Title", artist: "Artist", album: "Album", trackNumber: 7, duration: 0 }
    });
  });

  it("returns a structured error when ffmpeg fails", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "metadata-write-fail-"));
    const trackPath = path.join(root, "song.mp3");
    await writeFile(trackPath, "not real audio");
    const runner = vi.fn(async () => {
      throw new Error("ffmpeg rejected");
    });

    await expect(
      writeTrackMetadata(trackPath, { title: "Title", artist: "Artist", album: "Album", trackNumber: null }, { runner })
    ).resolves.toEqual({ ok: false, error: "ffmpeg rejected" });
  });

  it("uses an explicit ffmpeg path before bundled or PATH fallbacks", () => {
    expect(resolveFfmpegPath("/custom/ffmpeg")).toBe("/custom/ffmpeg");
  });
});
