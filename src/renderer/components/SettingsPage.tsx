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
    <section className="settings-page" aria-label="设置">
      <div className="settings-header">
        <p className="eyebrow">设置</p>
        <h2>设置</h2>
      </div>

      <section className="settings-section" aria-labelledby="library-settings-heading">
        <div className="settings-section-heading">
          <h3 id="library-settings-heading">音乐库</h3>
          <p>管理本地文件夹和音乐库扫描缓存。</p>
        </div>
        <div className="setting-row">
          <div>
            <strong>音乐文件夹</strong>
            <p className="settings-path">{folderPath ?? "尚未选择音乐文件夹。"}</p>
          </div>
        </div>
        <div className="settings-actions">
          <button className="primary-button" onClick={onChooseFolder} type="button">
            <FolderOpen size={16} />
            选择文件夹
          </button>
          <button className="secondary-button" disabled={!folderPath || isScanning} onClick={onRescanLibrary} type="button">
            <RefreshCw size={16} />
            重新扫描音乐库
          </button>
          <button className="secondary-button" onClick={onClearLibraryCache} type="button">
            <Trash2 size={16} />
            清除音乐库缓存
          </button>
        </div>
        {cacheStatus ? <p className="settings-status" role="status">{cacheStatus}</p> : null}
        {cacheError ? <p className="settings-error" role="alert">{cacheError}</p> : null}
      </section>

      <section className="settings-section" aria-labelledby="playback-settings-heading">
        <div className="settings-section-heading">
          <h3 id="playback-settings-heading">播放</h3>
          <p>播放偏好设置会显示在这里。</p>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="lyrics-settings-heading">
        <div className="settings-section-heading">
          <h3 id="lyrics-settings-heading">歌词</h3>
          <p>调整全屏歌词的可读性，不影响应用其他部分。</p>
        </div>
        <label className="lyrics-size-control">
          <span>全屏歌词字号</span>
          <strong>{fullscreenLyricsFontSize}px</strong>
          <input
            aria-label="全屏歌词字号"
            max={MAX_FULLSCREEN_LYRICS_FONT_SIZE}
            min={MIN_FULLSCREEN_LYRICS_FONT_SIZE}
            onChange={(event) => onFullscreenLyricsFontSizeChange(Number(event.target.value))}
            step="1"
            type="range"
            value={fullscreenLyricsFontSize}
          />
        </label>
        <p className="lyrics-preview" style={{ fontSize: `${fullscreenLyricsFontSize}px` }}>
          歌词预览行
        </p>
      </section>
    </section>
  );
}
