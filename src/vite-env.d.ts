/// <reference types="vite/client" />

import type {
  DesktopLyricsPayload,
  MediaActionResult,
  ScanProgress,
  ScanResult,
  Track,
  TrackMetadataUpdate,
  TrashTrackFilesResult,
  UpdateTrackMetadataResult
} from "./shared/types";

export type MenuCommand = "choose-folder" | "rescan-library" | "open-settings";

declare global {
  interface Window {
    musicApi: {
      chooseMusicFolder: () => Promise<ScanResult | null>;
      rescanLibrary: (folderPath: string) => Promise<ScanResult>;
      getPlayableUrl: (filePath: string) => Promise<string>;
      getArtworkUrl: (filePath: string | null) => Promise<string | null>;
      getLyrics: (filePath: string | null) => Promise<string | null>;
      showTrackInFolder: (filePath: string) => Promise<MediaActionResult>;
      updateTrackMetadata: (filePath: string, metadata: TrackMetadataUpdate) => Promise<UpdateTrackMetadataResult>;
      trashTrackLyrics: (track: Track) => Promise<MediaActionResult>;
      trashTrackFiles: (track: Track) => Promise<TrashTrackFilesResult>;
      listSystemFonts: () => Promise<string[]>;
      showDesktopLyrics: () => Promise<void>;
      closeDesktopLyrics: () => Promise<void>;
      updateDesktopLyrics: (payload: DesktopLyricsPayload) => Promise<void>;
      openMainSettingsFromDesktopLyrics: () => Promise<void>;
      onDesktopLyricsUpdate: (callback: (payload: DesktopLyricsPayload) => void) => () => void;
      onDesktopLyricsClosed: (callback: () => void) => () => void;
      onScanProgress: (callback: (progress: ScanProgress) => void) => () => void;
      onMenuCommand: (callback: (command: MenuCommand) => void) => () => void;
    };
  }
}

export {};
