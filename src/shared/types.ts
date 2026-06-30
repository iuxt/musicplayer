export type SupportedAudioExtension = "mp3" | "m4a" | "aac" | "wav" | "flac" | "ogg";

export interface Track {
  id: string;
  filePath: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  trackNumber: number | null;
  extension: SupportedAudioExtension;
  artworkId: string | null;
  artworkPath: string | null;
  lyricsPath: string | null;
  hasLyrics: boolean;
  folderPath: string;
}

export interface ScanWarning {
  filePath: string;
  reason: string;
}

export interface ScanProgress {
  currentFolder: string;
  discoveredTracks: number;
  warningCount: number;
}

export interface LibraryPlaylist {
  id: string;
  name: string;
  filePath: string;
  trackIds: string[];
}

export interface ScanResult {
  folderPath: string;
  tracks: Track[];
  playlists: LibraryPlaylist[];
  warnings: ScanWarning[];
}

export interface TrackMetadataUpdate {
  title: string;
  artist: string;
  album: string;
  trackNumber: number | null;
}

export interface TrackMetadataFields extends TrackMetadataUpdate {
  duration: number;
}

export type MediaActionResult = { ok: true } | { ok: false; error: string };

export type PlaylistMutationResult =
  | { ok: true; playlist: LibraryPlaylist }
  | { ok: false; error: string };

export interface TrashFileEntry {
  filePath: string;
  kind: "audio" | "lyrics" | "artwork";
}

export interface TrashTrackFilesResult {
  ok: boolean;
  audioRemoved: boolean;
  trashed: TrashFileEntry[];
  failed: Array<TrashFileEntry & { error: string }>;
  error: string | null;
}

export type UpdateTrackMetadataResult =
  | { ok: true; metadata: TrackMetadataFields }
  | { ok: false; error: string };

export interface DesktopLyricsPayload {
  trackTitle: string | null;
  artist: string | null;
  currentLine: string | null;
  nextLine: string | null;
  isLoading: boolean;
  fontFamily: string;
  fontSize: number;
}
