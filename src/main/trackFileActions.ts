import { access, readdir } from "node:fs/promises";
import path from "node:path";
import type { MediaActionResult, Track, TrashFileEntry, TrashTrackFilesResult } from "../shared/types.js";

const artworkExtensions = new Set(["jpg", "jpeg", "png", "webp"]);

export type TrashFile = (filePath: string) => Promise<void>;

export async function trashTrackLyrics(track: Track, trashFile: TrashFile): Promise<MediaActionResult> {
  if (!track.lyricsPath) {
    return { ok: true };
  }

  if (!(await exists(track.lyricsPath))) {
    return { ok: true };
  }

  try {
    await trashFile(track.lyricsPath);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "无法将歌词移到废纸篓。") };
  }
}

export async function trashTrackFiles(track: Track, trashFile: TrashFile): Promise<TrashTrackFilesResult> {
  const candidates = await buildTrackTrashCandidates(track);
  const trashed: TrashFileEntry[] = [];
  const failed: Array<TrashFileEntry & { error: string }> = [];
  let audioAlreadyMissing = false;

  for (const candidate of candidates) {
    if (!(await exists(candidate.filePath))) {
      audioAlreadyMissing = audioAlreadyMissing || candidate.kind === "audio";
      continue;
    }

    try {
      await trashFile(candidate.filePath);
      trashed.push(candidate);
    } catch (error) {
      failed.push({ ...candidate, error: errorMessage(error, "无法将文件移到废纸篓。") });
    }
  }

  const audioCandidate = candidates.find((candidate) => candidate.kind === "audio");
  const audioRemoved =
    audioAlreadyMissing ||
    !audioCandidate ||
    trashed.some((candidate) => candidate.kind === "audio" && candidate.filePath === audioCandidate.filePath);

  return {
    ok: failed.length === 0,
    audioRemoved,
    trashed,
    failed,
    error: failed.length === 0 ? null : summarizeTrashFailures(failed, audioRemoved)
  };
}

export async function buildTrackTrashCandidates(track: Track): Promise<TrashFileEntry[]> {
  const directory = path.dirname(track.filePath);
  const basename = path.basename(track.filePath, path.extname(track.filePath)).toLowerCase();
  const candidates: TrashFileEntry[] = [{ filePath: track.filePath, kind: "audio" }];
  let entries: string[];

  try {
    entries = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch {
    return candidates;
  }

  for (const entry of entries) {
    const entryExtension = path.extname(entry).slice(1).toLowerCase();
    const entryBasename = path.basename(entry, path.extname(entry)).toLowerCase();
    if (entryBasename !== basename) {
      continue;
    }

    if (entryExtension === "lrc") {
      candidates.push({ filePath: path.join(directory, entry), kind: "lyrics" });
    } else if (artworkExtensions.has(entryExtension)) {
      candidates.push({ filePath: path.join(directory, entry), kind: "artwork" });
    }
  }

  return candidates.sort(compareTrashCandidates);
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function summarizeTrashFailures(failed: Array<TrashFileEntry & { error: string }>, audioRemoved: boolean) {
  if (!audioRemoved && failed.some((entry) => entry.kind === "audio")) {
    return "无法将音乐文件移到废纸篓。";
  }
  return "音乐文件已移除，但部分关联文件无法移到废纸篓。";
}

function compareTrashCandidates(first: TrashFileEntry, second: TrashFileEntry) {
  const kindOrder: Record<TrashFileEntry["kind"], number> = {
    audio: 0,
    lyrics: 1,
    artwork: 2
  };
  return kindOrder[first.kind] - kindOrder[second.kind] || first.filePath.localeCompare(second.filePath);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
