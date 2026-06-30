import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LibraryPlaylist, ScanWarning, Track } from "../shared/types.js";

const supportedPlaylistExtensions = new Set(["m3u", "m3u8"]);

export async function readLibraryPlaylists(
  rootFolderPath: string,
  tracks: Track[],
  warnings: ScanWarning[]
): Promise<LibraryPlaylist[]> {
  const playlistsFolderPath = getPlaylistsFolderPath(rootFolderPath);
  let entries;
  try {
    entries = await readdir(playlistsFolderPath, { withFileTypes: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }

    warnings.push({
      filePath: playlistsFolderPath,
      reason: error instanceof Error ? error.message : "无法读取播放列表文件夹"
    });
    return [];
  }

  const playlistFiles = entries
    .filter((entry) => entry.isFile() && supportedPlaylistExtensions.has(path.extname(entry.name).slice(1).toLowerCase()))
    .sort((first, second) => first.name.localeCompare(second.name));

  const playlists: LibraryPlaylist[] = [];
  for (const entry of playlistFiles) {
    const playlistPath = path.join(playlistsFolderPath, entry.name);
    try {
      playlists.push(await readM3uPlaylist(playlistPath, tracks));
    } catch (error) {
      warnings.push({
        filePath: playlistPath,
        reason: error instanceof Error ? error.message : "无法读取播放列表"
      });
    }
  }

  return playlists;
}

export async function createM3uPlaylistFile(rootFolderPath: string, name: string): Promise<LibraryPlaylist> {
  const playlistsFolderPath = getPlaylistsFolderPath(rootFolderPath);
  await mkdir(playlistsFolderPath, { recursive: true });

  const playlistName = normalizePlaylistName(name);
  const playlistPath = path.join(playlistsFolderPath, `${playlistName}.m3u`);
  if (await fileExists(playlistPath)) {
    throw new Error("同名播放列表已存在。");
  }

  await writeFile(playlistPath, "#EXTM3U\n", { flag: "wx" });
  return {
    id: stableId(playlistPath),
    name: playlistName,
    filePath: playlistPath,
    trackIds: []
  };
}

export async function renameM3uPlaylistFile(
  rootFolderPath: string,
  playlist: LibraryPlaylist,
  name: string
): Promise<LibraryPlaylist> {
  const currentPath = assertManagedPlaylistPath(rootFolderPath, playlist.filePath);
  const playlistName = normalizePlaylistName(name);
  const extension = path.extname(currentPath) || ".m3u";
  const nextPath = path.join(getPlaylistsFolderPath(rootFolderPath), `${playlistName}${extension}`);

  if (normalizeFilePath(currentPath) !== normalizeFilePath(nextPath)) {
    if (await fileExists(nextPath)) {
      throw new Error("同名播放列表已存在。");
    }
    await rename(currentPath, nextPath);
  }

  return {
    ...playlist,
    id: stableId(nextPath),
    name: playlistName,
    filePath: nextPath
  };
}

export async function removeTrackFromM3uPlaylistFile(
  rootFolderPath: string,
  playlist: LibraryPlaylist,
  track: Track
): Promise<LibraryPlaylist> {
  const playlistPath = assertManagedPlaylistPath(rootFolderPath, playlist.filePath);
  const contents = await readFile(playlistPath, "utf8");
  const targetTrackPath = normalizeFilePath(track.filePath);
  const nextContents = removeM3uTrackEntry(contents, playlistPath, targetTrackPath);
  await writeFile(playlistPath, nextContents);
  return {
    ...playlist,
    trackIds: playlist.trackIds.filter((trackId) => trackId !== track.id)
  };
}

export async function addTrackToM3uPlaylistFile(
  rootFolderPath: string,
  playlist: LibraryPlaylist,
  track: Track
): Promise<LibraryPlaylist> {
  const playlistPath = assertManagedPlaylistPath(rootFolderPath, playlist.filePath);
  const contents = await readFile(playlistPath, "utf8");
  const nextTrackIds = playlist.trackIds.includes(track.id) ? playlist.trackIds : [...playlist.trackIds, track.id];

  if (m3uContainsTrack(contents, playlistPath, normalizeFilePath(track.filePath))) {
    return {
      ...playlist,
      trackIds: nextTrackIds
    };
  }

  await writeFile(playlistPath, appendM3uTrackEntry(contents, playlistPath, track.filePath));
  return {
    ...playlist,
    trackIds: nextTrackIds
  };
}

export async function deleteM3uPlaylistFile(
  rootFolderPath: string,
  playlist: LibraryPlaylist,
  removeFile: (filePath: string) => Promise<void>
): Promise<void> {
  const playlistPath = assertManagedPlaylistPath(rootFolderPath, playlist.filePath);
  await removeFile(playlistPath);
}

async function readM3uPlaylist(playlistPath: string, tracks: Track[]): Promise<LibraryPlaylist> {
  const contents = await readFile(playlistPath, "utf8");
  const tracksByPath = new Map(tracks.map((track) => [normalizeFilePath(track.filePath), track]));

  return {
    id: stableId(playlistPath),
    name: path.basename(playlistPath, path.extname(playlistPath)),
    filePath: playlistPath,
    trackIds: parseM3uTrackIds(contents, playlistPath, tracksByPath)
  };
}

function parseM3uTrackIds(contents: string, playlistPath: string, tracksByPath: Map<string, Track>) {
  const playlistFolderPath = path.dirname(playlistPath);
  const trackIds: string[] = [];

  for (const line of contents.split(/\r?\n/)) {
    const entryPath = resolveM3uEntryPath(line, playlistFolderPath);
    if (!entryPath) {
      continue;
    }

    const track = tracksByPath.get(normalizeFilePath(entryPath));
    if (track) {
      trackIds.push(track.id);
    }
  }

  return trackIds;
}

function m3uContainsTrack(contents: string, playlistPath: string, targetTrackPath: string) {
  const playlistFolderPath = path.dirname(playlistPath);

  for (const line of contents.split(/\r?\n/)) {
    const entryPath = resolveM3uEntryPath(line, playlistFolderPath);
    if (entryPath && normalizeFilePath(entryPath) === targetTrackPath) {
      return true;
    }
  }

  return false;
}

function appendM3uTrackEntry(contents: string, playlistPath: string, trackPath: string) {
  const relativeEntry = path.relative(path.dirname(playlistPath), trackPath).split(path.sep).join("/");
  if (!contents) {
    return `#EXTM3U\n${relativeEntry}\n`;
  }

  return `${contents}${contents.endsWith("\n") ? "" : "\n"}${relativeEntry}\n`;
}

function removeM3uTrackEntry(contents: string, playlistPath: string, targetTrackPath: string) {
  const playlistFolderPath = path.dirname(playlistPath);
  const output: string[] = [];
  let pendingComments: string[] = [];

  for (const line of contents.split(/\r?\n/)) {
    if (!line.trim()) {
      output.push(...pendingComments, line);
      pendingComments = [];
      continue;
    }

    if (line.trimStart().startsWith("#")) {
      if (line.trim().toUpperCase() === "#EXTM3U") {
        output.push(line);
      } else {
        pendingComments.push(line);
      }
      continue;
    }

    const entryPath = resolveM3uEntryPath(line, playlistFolderPath);
    if (entryPath && normalizeFilePath(entryPath) === targetTrackPath) {
      pendingComments = [];
      continue;
    }

    output.push(...pendingComments, line);
    pendingComments = [];
  }

  output.push(...pendingComments);
  return `${output.filter((line, index) => line || index < output.length - 1).join("\n")}\n`;
}

function resolveM3uEntryPath(line: string, playlistFolderPath: string) {
  const entry = line.trim().replace(/^\uFEFF/, "");
  if (!entry || entry.startsWith("#")) {
    return null;
  }

  if (entry.startsWith("file://")) {
    try {
      return fileURLToPath(entry);
    } catch {
      return null;
    }
  }

  if (hasUrlScheme(entry)) {
    return null;
  }

  return path.isAbsolute(entry) ? entry : path.resolve(playlistFolderPath, entry);
}

function assertManagedPlaylistPath(rootFolderPath: string, playlistPath: string) {
  const playlistsFolderPath = getPlaylistsFolderPath(rootFolderPath);
  const resolvedPath = path.resolve(playlistPath);
  const relativePath = path.relative(playlistsFolderPath, resolvedPath);
  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath) ||
    !supportedPlaylistExtensions.has(path.extname(resolvedPath).slice(1).toLowerCase())
  ) {
    throw new Error("播放列表不在音乐库的 playlists 文件夹中。");
  }

  return resolvedPath;
}

function normalizePlaylistName(name: string) {
  const normalizedName = name.trim().replace(/[\\/:]/g, " ").replace(/\s+/g, " ");
  if (!normalizedName) {
    throw new Error("播放列表名称不能为空。");
  }
  return normalizedName;
}

function getPlaylistsFolderPath(rootFolderPath: string) {
  return path.join(path.resolve(rootFolderPath), "playlists");
}

function hasUrlScheme(value: string) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value) && !/^[a-zA-Z]:[\\/]/.test(value);
}

function normalizeFilePath(filePath: string) {
  return path.resolve(filePath);
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isNotFoundError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function stableId(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}
