import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Track } from "../shared/types.js";
import { buildTrackTrashCandidates, trashTrackFiles, trashTrackLyrics } from "./trackFileActions.js";

describe("track file actions", () => {
  it("trashes current lyrics and treats a missing lyrics path as success", async () => {
    const root = await mkdirTemp("lyrics-trash-");
    const lyricsPath = path.join(root, "song.lrc");
    await writeFile(lyricsPath, "[00:01.00]line", "utf8");
    const trash = vi.fn(async () => undefined);

    await expect(trashTrackLyrics(makeTrack({ lyricsPath, hasLyrics: true }), trash)).resolves.toEqual({ ok: true });
    expect(trash).toHaveBeenCalledWith(lyricsPath);
    await expect(trashTrackLyrics(makeTrack({ lyricsPath: null, hasLyrics: false }), trash)).resolves.toEqual({ ok: true });
  });

  it("includes audio, same-basename lyrics, and same-basename artwork", async () => {
    const root = await mkdirTemp("track-trash-");
    const audioPath = path.join(root, "song.mp3");
    await writeFile(audioPath, "audio");
    await writeFile(path.join(root, "song.lrc"), "lyrics");
    await writeFile(path.join(root, "song.jpg"), "artwork");
    await writeFile(path.join(root, "cover.jpg"), "shared artwork");

    expect(await buildTrackTrashCandidates(makeTrack({ filePath: audioPath }))).toEqual([
      { filePath: audioPath, kind: "audio" },
      { filePath: path.join(root, "song.lrc"), kind: "lyrics" },
      { filePath: path.join(root, "song.jpg"), kind: "artwork" }
    ]);
  });

  it("treats an already missing audio file as removed", async () => {
    const root = await mkdirTemp("audio-trash-missing-");
    const audioPath = path.join(root, "missing.flac");
    const trash = vi.fn(async () => undefined);

    await expect(trashTrackFiles(makeTrack({ filePath: audioPath }), trash)).resolves.toMatchObject({
      ok: true,
      audioRemoved: true,
      trashed: [],
      failed: [],
      error: null
    });
    expect(trash).not.toHaveBeenCalled();
  });

  it("keeps the track when the audio file cannot be trashed", async () => {
    const root = await mkdirTemp("audio-trash-fail-");
    const audioPath = path.join(root, "song.flac");
    await writeFile(audioPath, "audio");
    const trash = vi.fn(async (filePath: string) => {
      if (filePath === audioPath) {
        throw new Error("trash rejected");
      }
    });

    await expect(trashTrackFiles(makeTrack({ filePath: audioPath }), trash)).resolves.toMatchObject({
      ok: false,
      audioRemoved: false,
      trashed: [],
      failed: [{ filePath: audioPath, kind: "audio", error: "trash rejected" }],
      error: "Unable to move the music file to trash."
    });
  });
});

async function mkdirTemp(prefix: string) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: "track-id",
    filePath: "/music/song.mp3",
    title: "Song",
    artist: "Artist",
    album: "Album",
    duration: 180,
    trackNumber: null,
    extension: "mp3",
    artworkId: null,
    artworkPath: null,
    lyricsPath: null,
    hasLyrics: false,
    folderPath: "",
    ...overrides
  };
}
