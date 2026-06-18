import { createHash } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ScanProgress, ScanResult, ScanWarning, SupportedAudioExtension, Track } from "../shared/types.js";

const supportedExtensions = new Set<SupportedAudioExtension>(["mp3", "m4a", "aac", "wav", "flac", "ogg"]);
const supportedArtworkExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
const preferredArtworkNames = ["cover", "folder", "front"];
const progressTrackInterval = 16;

interface ScanOptions {
  onProgress?: (progress: ScanProgress) => void;
}

export async function scanMusicFolder(folderPath: string, options: ScanOptions = {}): Promise<ScanResult> {
  const tracks: Track[] = [];
  const warnings: ScanWarning[] = [];
  let lastProgress: ScanProgress | null = null;

  async function walk(currentFolder: string) {
    let entries;
    try {
      entries = await readdir(currentFolder, { withFileTypes: true });
    } catch (error) {
      warnings.push({
        filePath: currentFolder,
        reason: error instanceof Error ? error.message : "无法读取文件夹"
      });
      report(currentFolder);
      return;
    }

    report(currentFolder);
    const siblingFileNames = entries.map((folderEntry) => folderEntry.name);

    for (const entry of entries) {
      const entryPath = path.join(currentFolder, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = getSupportedExtension(entry.name);
      if (!extension) {
        continue;
      }

      const track = await buildTrack(entryPath, folderPath, extension, siblingFileNames);
      tracks.push(track);
      report(currentFolder);
    }
  }

  function report(currentFolder: string, force = false) {
    if (!options.onProgress) {
      return;
    }

    const progress: ScanProgress = {
      currentFolder,
      discoveredTracks: tracks.length,
      warningCount: warnings.length
    };
    const shouldReport =
      force ||
      lastProgress === null ||
      progress.currentFolder !== lastProgress.currentFolder ||
      progress.warningCount !== lastProgress.warningCount ||
      progress.discoveredTracks - lastProgress.discoveredTracks >= progressTrackInterval;

    if (!shouldReport) {
      return;
    }

    lastProgress = progress;
    options.onProgress(progress);
  }

  await walk(folderPath);
  report(folderPath, true);

  return {
    folderPath,
    tracks: tracks.sort((a, b) => a.title.localeCompare(b.title)),
    warnings
  };
}

export function getSupportedExtension(fileName: string): SupportedAudioExtension | null {
  const extension = path.extname(fileName).slice(1).toLowerCase();
  return supportedExtensions.has(extension as SupportedAudioExtension)
    ? (extension as SupportedAudioExtension)
    : null;
}

async function buildTrack(
  filePath: string,
  rootFolderPath: string,
  extension: SupportedAudioExtension,
  siblingFileNames: string[]
): Promise<Track> {
  const fallbackTitle = path.basename(filePath, path.extname(filePath));
  let title = fallbackTitle;
  let artist = "未知歌手";
  let album = "未知专辑";
  let duration = 0;
  let trackNumber: number | null = null;
  let artworkId: string | null = null;
  let artworkPath: string | null = findArtworkPath(filePath, siblingFileNames);
  const lyricsPath = findLyricsPath(filePath, fallbackTitle, siblingFileNames);

  try {
    const metadata = await parseAudioFile(filePath);
    title = metadata.common.title?.trim() || title;
    artist = metadata.common.artist?.trim() || artist;
    album = metadata.common.album?.trim() || album;
    duration = Number.isFinite(metadata.format.duration) ? metadata.format.duration ?? 0 : 0;
    trackNumber = metadata.common.track.no ?? null;
    if (metadata.common.picture?.[0]) {
      artworkPath = await writeEmbeddedArtwork(filePath, metadata.common.picture[0]);
    }
    artworkId = artworkPath ? stableId(`${filePath}:artwork`) : null;
  } catch {
    // Invalid or tagless audio files still belong in the library with filename fallbacks.
  }

  return {
    id: stableId(filePath),
    filePath,
    title,
    artist,
    album,
    duration,
    trackNumber,
    extension,
    artworkId,
    artworkPath,
    lyricsPath,
    hasLyrics: lyricsPath !== null,
    folderPath: path.dirname(path.relative(rootFolderPath, filePath))
  };
}

function findLyricsPath(filePath: string, fallbackTitle: string, siblingFileNames: string[]): string | null {
  const directory = path.dirname(filePath);
  const candidates = new Set([
    `${path.basename(filePath, path.extname(filePath))}.lrc`,
    `${fallbackTitle}.lrc`
  ].map((candidate) => candidate.toLowerCase()));

  const match = siblingFileNames.find((name) => candidates.has(name.toLowerCase()));
  return match ? path.join(directory, match) : null;
}

function findArtworkPath(filePath: string, siblingFileNames: string[]): string | null {
  const directory = path.dirname(filePath);
  const trackBaseName = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const artworkFiles = siblingFileNames.filter((name) => supportedArtworkExtensions.has(path.extname(name).slice(1).toLowerCase()));

  const sameName = artworkFiles.find((name) => path.basename(name, path.extname(name)).toLowerCase() === trackBaseName);
  if (sameName) {
    return path.join(directory, sameName);
  }

  const preferred = artworkFiles.find((name) => preferredArtworkNames.includes(path.basename(name, path.extname(name)).toLowerCase()));
  return preferred ? path.join(directory, preferred) : null;
}

function stableId(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

async function parseAudioFile(filePath: string) {
  const metadataModule = (await import("music-metadata")) as unknown as {
    parseFile?: (filePath: string) => Promise<{
      common: {
        title?: string;
        artist?: string;
        album?: string;
        track: { no?: number | null };
        picture?: Array<{ format: string; data: Uint8Array }>;
      };
      format: {
        duration?: number;
      };
    }>;
  };

  if (!metadataModule.parseFile) {
    throw new Error("music-metadata parseFile is unavailable in this runtime");
  }

  return metadataModule.parseFile(filePath);
}

export async function writeEmbeddedArtwork(
  trackPath: string,
  picture: { format: string; data: Uint8Array }
): Promise<string> {
  const cacheDir = path.join(os.tmpdir(), "musicplayer-artwork");
  await mkdir(cacheDir, { recursive: true });
  const extension = artworkExtensionForFormat(picture.format);
  const artworkPath = path.join(cacheDir, `${stableId(trackPath)}.${extension}`);
  await writeFile(artworkPath, Buffer.from(picture.data));
  return artworkPath;
}

function artworkExtensionForFormat(format: string): "jpg" | "png" | "webp" {
  const normalized = format.toLowerCase();
  if (normalized.includes("png")) {
    return "png";
  }
  if (normalized.includes("webp")) {
    return "webp";
  }
  return "jpg";
}
