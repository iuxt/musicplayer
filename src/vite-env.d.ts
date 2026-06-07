/// <reference types="vite/client" />

import type { ScanProgress, ScanResult } from "./shared/types";

export type MenuCommand = "choose-folder" | "rescan-library";

declare global {
  interface Window {
    musicApi: {
      chooseMusicFolder: () => Promise<ScanResult | null>;
      rescanLibrary: (folderPath: string) => Promise<ScanResult>;
      getPlayableUrl: (filePath: string) => Promise<string>;
      getArtworkUrl: (filePath: string | null) => Promise<string | null>;
      getLyrics: (filePath: string | null) => Promise<string | null>;
      onScanProgress: (callback: (progress: ScanProgress) => void) => () => void;
      onMenuCommand: (callback: (command: MenuCommand) => void) => () => void;
    };
  }
}

export {};
