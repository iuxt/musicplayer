import { FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import {
  MAX_DESKTOP_LYRICS_FONT_SIZE,
  MAX_FULLSCREEN_LYRICS_FONT_SIZE,
  MIN_DESKTOP_LYRICS_FONT_SIZE,
  MIN_FULLSCREEN_LYRICS_FONT_SIZE
} from "../appSettings";

interface SettingsPageProps {
  folderPath: string | null;
  isScanning: boolean;
  availableFontFamilies: string[];
  fullscreenLyricsFontFamily: string;
  fullscreenLyricsFontSize: number;
  systemMediaShortcutsEnabled: boolean;
  desktopLyricsEnabled: boolean;
  desktopLyricsFontFamily: string;
  desktopLyricsFontSize: number;
  cacheStatus: string | null;
  cacheError: string | null;
  onChooseFolder: () => void;
  onRescanLibrary: () => void;
  onClearLibraryCache: () => void;
  onFullscreenLyricsFontFamilyChange: (fontFamily: string) => void;
  onFullscreenLyricsFontSizeChange: (fontSize: number) => void;
  onSystemMediaShortcutsEnabledChange: (enabled: boolean) => void;
  onDesktopLyricsEnabledChange: (enabled: boolean) => void;
  onDesktopLyricsFontFamilyChange: (fontFamily: string) => void;
  onDesktopLyricsFontSizeChange: (fontSize: number) => void;
}

export function SettingsPage({
  folderPath,
  isScanning,
  availableFontFamilies,
  fullscreenLyricsFontFamily,
  fullscreenLyricsFontSize,
  systemMediaShortcutsEnabled,
  desktopLyricsEnabled,
  desktopLyricsFontFamily,
  desktopLyricsFontSize,
  cacheStatus,
  cacheError,
  onChooseFolder,
  onRescanLibrary,
  onClearLibraryCache,
  onFullscreenLyricsFontFamilyChange,
  onFullscreenLyricsFontSizeChange,
  onSystemMediaShortcutsEnabledChange,
  onDesktopLyricsEnabledChange,
  onDesktopLyricsFontFamilyChange,
  onDesktopLyricsFontSizeChange
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
        </div>
        <label className="setting-toggle">
          <input
            aria-label="系统媒体快捷键"
            checked={systemMediaShortcutsEnabled}
            onChange={(event) => onSystemMediaShortcutsEnabledChange(event.target.checked)}
            type="checkbox"
          />
          <span>系统媒体快捷键</span>
        </label>
      </section>

      <section className="settings-section" aria-labelledby="lyrics-settings-heading">
        <div className="settings-section-heading">
          <h3 id="lyrics-settings-heading">歌词</h3>
          <p>分别调整全屏歌词和桌面歌词的字体。</p>
        </div>

        <div className="lyrics-settings-group">
          <h4>全屏歌词</h4>
          <label className="lyrics-select-control">
            <span>字体</span>
            <select
              aria-label="全屏歌词字体"
              onChange={(event) => onFullscreenLyricsFontFamilyChange(event.target.value)}
              value={fullscreenLyricsFontFamily}
            >
              {availableFontFamilies.map((fontFamily) => (
                <option key={fontFamily || "system-default"} value={fontFamily}>
                  {fontFamily || "系统默认"}
                </option>
              ))}
            </select>
          </label>
          <label className="lyrics-size-control">
            <span>字号</span>
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
          <p
            className="lyrics-preview"
            style={{ fontFamily: fullscreenLyricsFontFamily || undefined, fontSize: `${fullscreenLyricsFontSize}px` }}
          >
            全屏歌词预览行
          </p>
        </div>

        <div className="lyrics-settings-group">
          <h4>桌面歌词</h4>
          <label className="setting-toggle">
            <input
              aria-label="显示桌面歌词"
              checked={desktopLyricsEnabled}
              onChange={(event) => onDesktopLyricsEnabledChange(event.target.checked)}
              type="checkbox"
            />
            <span>显示桌面歌词</span>
          </label>
          <label className="lyrics-select-control">
            <span>字体</span>
            <select
              aria-label="桌面歌词字体"
              onChange={(event) => onDesktopLyricsFontFamilyChange(event.target.value)}
              value={desktopLyricsFontFamily}
            >
              {availableFontFamilies.map((fontFamily) => (
                <option key={fontFamily || "system-default"} value={fontFamily}>
                  {fontFamily || "系统默认"}
                </option>
              ))}
            </select>
          </label>
          <label className="lyrics-size-control">
            <span>字号</span>
            <strong>{desktopLyricsFontSize}px</strong>
            <input
              aria-label="桌面歌词字号"
              max={MAX_DESKTOP_LYRICS_FONT_SIZE}
              min={MIN_DESKTOP_LYRICS_FONT_SIZE}
              onChange={(event) => onDesktopLyricsFontSizeChange(Number(event.target.value))}
              step="1"
              type="range"
              value={desktopLyricsFontSize}
            />
          </label>
          <div
            className="desktop-lyrics-preview"
            style={{ fontFamily: desktopLyricsFontFamily || undefined, fontSize: `${desktopLyricsFontSize}px` }}
          >
            <p>桌面歌词预览行</p>
            <span>下一句歌词预览</span>
          </div>
        </div>
      </section>
    </section>
  );
}
