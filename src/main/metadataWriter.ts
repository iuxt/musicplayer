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
    return { ok: false, error: errorMessage(error, "Invalid metadata.") };
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
    return { ok: false, error: errorMessage(error, "Unable to update music information.") };
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
    throw new Error("Title is required.");
  }
  if (!normalized.artist) {
    throw new Error("Artist is required.");
  }
  if (!normalized.album) {
    throw new Error("Album is required.");
  }
  if (
    normalized.trackNumber !== null &&
    (!Number.isInteger(normalized.trackNumber) || normalized.trackNumber <= 0)
  ) {
    throw new Error("Track number must be a positive integer.");
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
