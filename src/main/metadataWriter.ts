import { execFile } from "node:child_process";
import { mkdir, rename, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import type { TrackMetadataFields, TrackMetadataUpdate, UpdateTrackMetadataResult } from "../shared/types.js";

type FfmpegRunner = (binary: string, args: string[]) => Promise<void>;

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

export async function writeTrackMetadata(
  filePath: string,
  metadata: TrackMetadataUpdate,
  options: { runner?: FfmpegRunner; ffmpegPath?: string } = {}
): Promise<UpdateTrackMetadataResult> {
  let normalized: TrackMetadataUpdate;
  try {
    normalized = normalizeTrackMetadataUpdate(metadata);
  } catch (error) {
    return { ok: false, error: errorMessage(error, "无效的音乐信息。") };
  }

  const tempPath = temporaryAudioPath(filePath);
  const runner = options.runner ?? runFfmpeg;
  const ffmpegPath = resolveFfmpegPath(options.ffmpegPath);

  try {
    await mkdir(path.dirname(tempPath), { recursive: true });
    await runner(ffmpegPath, buildFfmpegMetadataArgs(filePath, tempPath, normalized));
    await rename(tempPath, filePath);
    return { ok: true, metadata: await readTrackMetadataFields(filePath, normalized) };
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    return { ok: false, error: errorMessage(error, "无法更新音乐信息。") };
  }
}

export function normalizeTrackMetadataUpdate(metadata: TrackMetadataUpdate): TrackMetadataUpdate {
  const normalized = {
    title: metadata.title.trim(),
    artist: metadata.artist.trim(),
    album: metadata.album.trim(),
    trackNumber: metadata.trackNumber
  };

  if (!normalized.title) {
    throw new Error("标题不能为空");
  }
  if (!normalized.artist) {
    throw new Error("歌手不能为空");
  }
  if (!normalized.album) {
    throw new Error("专辑不能为空");
  }
  if (
    normalized.trackNumber !== null &&
    (!Number.isInteger(normalized.trackNumber) || normalized.trackNumber <= 0)
  ) {
    throw new Error("曲号必须是正整数");
  }

  return normalized;
}

export function buildFfmpegMetadataArgs(inputPath: string, outputPath: string, metadata: TrackMetadataUpdate) {
  return [
    "-y",
    "-i",
    inputPath,
    "-map",
    "0",
    "-codec",
    "copy",
    "-metadata",
    `title=${metadata.title}`,
    "-metadata",
    `artist=${metadata.artist}`,
    "-metadata",
    `album=${metadata.album}`,
    "-metadata",
    `track=${metadata.trackNumber ?? ""}`,
    outputPath
  ];
}

export async function readTrackMetadataFields(
  filePath: string,
  fallback: TrackMetadataUpdate
): Promise<TrackMetadataFields> {
  try {
    const metadataModule = (await import("music-metadata")) as unknown as {
      parseFile?: (filePath: string) => Promise<{
        common: {
          title?: string;
          artist?: string;
          album?: string;
          track: { no?: number | null };
        };
        format: { duration?: number };
      }>;
    };
    const parsed = metadataModule.parseFile ? await metadataModule.parseFile(filePath) : null;
    return {
      title: parsed?.common.title?.trim() || fallback.title,
      artist: parsed?.common.artist?.trim() || fallback.artist,
      album: parsed?.common.album?.trim() || fallback.album,
      trackNumber: parsed?.common.track.no ?? fallback.trackNumber,
      duration: Number.isFinite(parsed?.format.duration) ? parsed?.format.duration ?? 0 : 0
    };
  } catch {
    return { ...fallback, duration: 0 };
  }
}

export function resolveFfmpegPath(explicitPath?: string) {
  return explicitPath || process.env.FFMPEG_PATH || resolveBundledFfmpegPath() || "ffmpeg";
}

async function runFfmpeg(binary: string, args: string[]) {
  await execFileAsync(binary, args);
}

function temporaryAudioPath(filePath: string) {
  const extension = path.extname(filePath);
  const basename = path.basename(filePath, extension);
  return path.join(path.dirname(filePath), `.${basename}.${process.pid}.${Date.now()}.metadata${extension}`);
}

function resolveBundledFfmpegPath() {
  try {
    const value = require("ffmpeg-static") as unknown;
    return typeof value === "string" && value ? value : null;
  } catch {
    return null;
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
