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

export interface ScanResult {
  folderPath: string;
  tracks: Track[];
  warnings: ScanWarning[];
}
