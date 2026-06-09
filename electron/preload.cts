import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { ScanProgress, ScanResult, Track, TrackMetadataUpdate } from "../src/shared/types.js";

type MenuCommand = "choose-folder" | "rescan-library";

contextBridge.exposeInMainWorld("musicApi", {
  chooseMusicFolder: (): Promise<ScanResult | null> => ipcRenderer.invoke("library:choose-folder"),
  rescanLibrary: (folderPath: string): Promise<ScanResult> => ipcRenderer.invoke("library:rescan", folderPath),
  getPlayableUrl: (filePath: string): Promise<string> => ipcRenderer.invoke("media:get-playable-url", filePath),
  getArtworkUrl: (filePath: string | null): Promise<string | null> => ipcRenderer.invoke("media:get-artwork-url", filePath),
  getLyrics: (filePath: string | null): Promise<string | null> => ipcRenderer.invoke("media:get-lyrics", filePath),
  showTrackInFolder: (filePath: string) => ipcRenderer.invoke("media:show-track-in-folder", filePath),
  updateTrackMetadata: (filePath: string, metadata: TrackMetadataUpdate) =>
    ipcRenderer.invoke("media:update-track-metadata", filePath, metadata),
  trashTrackLyrics: (track: Track) => ipcRenderer.invoke("media:trash-track-lyrics", track),
  trashTrackFiles: (track: Track) => ipcRenderer.invoke("media:trash-track-files", track),
  onScanProgress: (callback: (progress: ScanProgress) => void) => {
    const listener = (_event: IpcRendererEvent, progress: ScanProgress) => callback(progress);
    ipcRenderer.on("library:scan-progress", listener);
    return () => ipcRenderer.removeListener("library:scan-progress", listener);
  },
  onMenuCommand: (callback: (command: MenuCommand) => void) => {
    const listener = (_event: IpcRendererEvent, command: MenuCommand) => callback(command);
    ipcRenderer.on("library:menu-command", listener);
    return () => ipcRenderer.removeListener("library:menu-command", listener);
  }
});
