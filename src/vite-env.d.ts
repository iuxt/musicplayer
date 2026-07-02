/// <reference types="vite/client" />

import type {
  DesktopLyricsPayload,
  LibraryPlaylist,
  MediaActionResult,
  PlaylistMutationResult,
  ScanProgress,
  ScanResult,
  Track,
  TrackMetadataUpdate,
  TrashTrackFilesResult,
  UpdateTrackMetadataResult
} from "./shared/types";

export type MenuCommand = "choose-folder" | "rescan-library" | "open-settings";
export type MediaKeyCommand = "play-pause" | "next" | "previous";
export type SystemMediaShortcutsResult = { ok: true } | { ok: false; failedCommands: MediaKeyCommand[] };
export type SystemMediaShortcutsPermissionResult =
  | { ok: true }
  | { ok: false; reason: "accessibility-permission-denied" };

declare global {
  const __APP_VERSION__: string;

  interface Window {
    musicApi: {
      chooseMusicFolder: () => Promise<ScanResult | null>;
      rescanLibrary: (folderPath: string) => Promise<ScanResult>;
      readLibraryCache: (folderPath?: string) => Promise<unknown | null>;
      writeLibraryCache: (result: ScanResult) => Promise<void>;
      clearLibraryCache: () => Promise<void>;
      createPlaylist: (folderPath: string, name: string) => Promise<PlaylistMutationResult>;
      renamePlaylist: (folderPath: string, playlist: LibraryPlaylist, name: string) => Promise<PlaylistMutationResult>;
      deletePlaylist: (folderPath: string, playlist: LibraryPlaylist) => Promise<MediaActionResult>;
      removeTrackFromPlaylist: (
        folderPath: string,
        playlist: LibraryPlaylist,
        track: Track
      ) => Promise<PlaylistMutationResult>;
      addTrackToPlaylist: (
        folderPath: string,
        playlist: LibraryPlaylist,
        track: Track
      ) => Promise<PlaylistMutationResult>;
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
      resizeDesktopLyrics: (width: number, height: number) => Promise<void>;
      openMainSettingsFromDesktopLyrics: () => Promise<void>;
      ensureSystemMediaShortcutsPermission: () => Promise<SystemMediaShortcutsPermissionResult>;
      setSystemMediaShortcutsEnabled: (enabled: boolean) => Promise<SystemMediaShortcutsResult>;
      setCloseWindowStopsPlayback: (enabled: boolean) => Promise<void>;
      onDesktopLyricsUpdate: (callback: (payload: DesktopLyricsPayload) => void) => () => void;
      onDesktopLyricsClosed: (callback: () => void) => () => void;
      onScanProgress: (callback: (progress: ScanProgress) => void) => () => void;
      onMenuCommand: (callback: (command: MenuCommand) => void) => () => void;
      onMediaKeyCommand: (callback: (command: MediaKeyCommand) => void) => () => void;
    };
  }
}

export {};
