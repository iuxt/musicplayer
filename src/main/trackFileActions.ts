import { constants } from "node:fs";
import { access, copyFile, mkdir, readdir, rename, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { MediaActionResult, Track, TrashFileEntry, TrashTrackFilesResult } from "../shared/types.js";

const artworkExtensions = new Set(["jpg", "jpeg", "png", "webp"]);

export type TrashFile = (filePath: string) => Promise<void>;

export async function trashFileWithFallback(
  filePath: string,
  primaryTrash: TrashFile,
  fallbackTrash: TrashFile = moveFileToUserTrash
): Promise<void> {
  try {
    await primaryTrash(filePath);
  } catch (primaryError) {
    try {
      await fallbackTrash(filePath);
    } catch (fallbackError) {
      throw combineTrashErrors(primaryError, fallbackError);
    }
  }
}

export async function moveFileToUserTrash(filePath: string, trashRoot = path.join(os.homedir(), ".Trash")): Promise<void> {
  await mkdir(trashRoot, { recursive: true });
  const destination = await getAvailableTrashPath(trashRoot, path.basename(filePath));

  try {
    await rename(filePath, destination);
  } catch (error) {
    if (getErrorCode(error) !== "EXDEV") {
      throw error;
    }

    await copyAcrossDevicesAndUnlink(filePath, destination);
  }
}

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

async function getAvailableTrashPath(trashRoot: string, fileName: string) {
  const extension = path.extname(fileName);
  const basename = path.basename(fileName, extension);

  for (let index = 0; index < 1000; index += 1) {
    const candidateName = index === 0 ? fileName : `${basename} ${index}${extension}`;
    const candidatePath = path.join(trashRoot, candidateName);
    if (!(await exists(candidatePath))) {
      return candidatePath;
    }
  }

  throw new Error("无法在废纸篓中生成可用文件名。");
}

async function copyAcrossDevicesAndUnlink(source: string, destination: string) {
  try {
    await copyFile(source, destination, constants.COPYFILE_EXCL);
    await unlink(source);
  } catch (error) {
    await unlink(destination).catch(() => undefined);
    throw error;
  }
}

function combineTrashErrors(primaryError: unknown, fallbackError: unknown) {
  const primaryMessage = errorMessage(primaryError, "系统废纸篓接口失败。");
  const fallbackMessage = errorMessage(fallbackError, "移动到用户废纸篓失败。");
  return new Error(`${primaryMessage}；备用删除也失败：${fallbackMessage}`);
}

function getErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : null;
}
