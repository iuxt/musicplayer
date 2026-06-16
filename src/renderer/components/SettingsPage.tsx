import { FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import {
  MAX_FULLSCREEN_LYRICS_FONT_SIZE,
  MIN_FULLSCREEN_LYRICS_FONT_SIZE
} from "../appSettings";

interface SettingsPageProps {
  folderPath: string | null;
  isScanning: boolean;
  fullscreenLyricsFontSize: number;
  cacheStatus: string | null;
  cacheError: string | null;
  onChooseFolder: () => void;
  onRescanLibrary: () => void;
  onClearLibraryCache: () => void;
  onFullscreenLyricsFontSizeChange: (fontSize: number) => void;
}

export function SettingsPage({
  folderPath,
  isScanning,
  fullscreenLyricsFontSize,
  cacheStatus,
  cacheError,
  onChooseFolder,
  onRescanLibrary,
  onClearLibraryCache,
  onFullscreenLyricsFontSizeChange
}: SettingsPageProps) {
  return (
    <section className="settings-page" aria-label="Settings">
      <div className="settings-header">
        <p className="eyebrow">Settings</p>
        <h2>Settings</h2>
      </div>

      <section className="settings-section" aria-labelledby="library-settings-heading">
        <div className="settings-section-heading">
          <h3 id="library-settings-heading">Library</h3>
          <p>Manage the local folder and cached library scan.</p>
        </div>
        <div className="setting-row">
          <div>
            <strong>Music folder</strong>
            <p className="settings-path">{folderPath ?? "No music folder selected."}</p>
          </div>
        </div>
        <div className="settings-actions">
          <button className="primary-button" onClick={onChooseFolder} type="button">
            <FolderOpen size={16} />
            Choose Folder
          </button>
          <button className="secondary-button" disabled={!folderPath || isScanning} onClick={onRescanLibrary} type="button">
            <RefreshCw size={16} />
            Rescan Library
          </button>
          <button className="secondary-button" onClick={onClearLibraryCache} type="button">
            <Trash2 size={16} />
            Clear Library Cache
          </button>
        </div>
        {cacheStatus ? <p className="settings-status" role="status">{cacheStatus}</p> : null}
        {cacheError ? <p className="settings-error" role="alert">{cacheError}</p> : null}
      </section>

      <section className="settings-section" aria-labelledby="playback-settings-heading">
        <div className="settings-section-heading">
          <h3 id="playback-settings-heading">Playback</h3>
          <p>Playback preferences will appear here.</p>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="lyrics-settings-heading">
        <div className="settings-section-heading">
          <h3 id="lyrics-settings-heading">Lyrics</h3>
          <p>Adjust fullscreen lyrics readability without changing the rest of the app.</p>
        </div>
        <label className="lyrics-size-control">
          <span>Fullscreen lyrics font size</span>
          <strong>{fullscreenLyricsFontSize}px</strong>
          <input
            aria-label="Fullscreen lyrics font size"
            max={MAX_FULLSCREEN_LYRICS_FONT_SIZE}
            min={MIN_FULLSCREEN_LYRICS_FONT_SIZE}
            onChange={(event) => onFullscreenLyricsFontSizeChange(Number(event.target.value))}
            step="1"
            type="range"
            value={fullscreenLyricsFontSize}
          />
        </label>
        <p className="lyrics-preview" style={{ fontSize: `${fullscreenLyricsFontSize}px` }}>
          Lyrics preview line
        </p>
      </section>
    </section>
  );
}
