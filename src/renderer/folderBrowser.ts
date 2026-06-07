import type { Track } from "../shared/types";

export interface FolderBrowserFolderRow {
  type: "folder";
  key: string;
  label: string;
  path: string;
  detail: string;
  tracks: Track[];
}

export interface FolderBrowserTrackRow {
  type: "track";
  key: string;
  track: Track;
}

export type FolderBrowserRow = FolderBrowserFolderRow | FolderBrowserTrackRow;

export function buildFolderBrowserRows(tracks: Track[], currentFolderPath: string | null): FolderBrowserRow[] {
  const currentSegments = splitFolderPath(currentFolderPath);
  const folderGroups = new Map<string, { label: string; path: string; tracks: Track[] }>();
  const currentTracks: Track[] = [];

  for (const track of tracks) {
    const trackSegments = splitFolderPath(track.folderPath);
    if (!startsWithSegments(trackSegments, currentSegments)) {
      continue;
    }

    const remainingSegments = trackSegments.slice(currentSegments.length);
    if (remainingSegments.length === 0) {
      currentTracks.push(track);
      continue;
    }

    const label = remainingSegments[0];
    const path = [...currentSegments, label].join("/");
    const existing = folderGroups.get(path);
    if (existing) {
      existing.tracks.push(track);
    } else {
      folderGroups.set(path, { label, path, tracks: [track] });
    }
  }

  const folderRows = [...folderGroups.values()]
    .map((folder): FolderBrowserFolderRow => ({
      type: "folder",
      key: `folder:${folder.path}`,
      label: folder.label,
      path: folder.path,
      detail: unique(folder.tracks.map((track) => track.album)).join(", "),
      tracks: folder.tracks
    }))
    .sort((first, second) => first.label.localeCompare(second.label));

  const trackRows = currentTracks.map((track): FolderBrowserTrackRow => ({ type: "track", key: track.id, track }));

  return [...folderRows, ...trackRows];
}

export function getTracksAtFolderLevel(tracks: Track[], currentFolderPath: string | null) {
  const currentSegments = splitFolderPath(currentFolderPath);

  return tracks.filter((track) => {
    const trackSegments = splitFolderPath(track.folderPath);
    return trackSegments.length === currentSegments.length && startsWithSegments(trackSegments, currentSegments);
  });
}

export function getParentFolderPath(currentFolderPath: string | null) {
  const segments = splitFolderPath(currentFolderPath);
  if (segments.length <= 1) {
    return null;
  }

  return segments.slice(0, -1).join("/");
}

function splitFolderPath(folderPath: string | null) {
  if (!folderPath || folderPath === ".") {
    return [];
  }

  return folderPath.split(/[\\/]+/).filter((segment) => segment && segment !== ".");
}

function startsWithSegments(segments: string[], prefix: string[]) {
  return prefix.every((segment, index) => segments[index] === segment);
}

function unique(values: string[]) {
  return [...new Set(values)].filter(Boolean);
}
