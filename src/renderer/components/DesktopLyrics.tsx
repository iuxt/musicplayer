import { Settings, X } from "lucide-react";
import type { CSSProperties } from "react";
import type { DesktopLyricsPayload } from "../../shared/types";

interface DesktopLyricsProps {
  payload: DesktopLyricsPayload;
  onClose: () => void;
  onOpenSettings: () => void;
}

export function DesktopLyrics({ payload, onClose, onOpenSettings }: DesktopLyricsProps) {
  const style = {
    "--desktop-lyrics-font-family": payload.fontFamily
      ? `"${payload.fontFamily}", ui-sans-serif, system-ui, sans-serif`
      : "ui-sans-serif, system-ui, sans-serif",
    "--desktop-lyrics-font-size": `${payload.fontSize}px`
  } as CSSProperties & Record<"--desktop-lyrics-font-family" | "--desktop-lyrics-font-size", string>;

  return (
    <section className="desktop-lyrics-shell" aria-label="桌面歌词" style={style}>
      <div className="desktop-lyrics-controls">
        <button className="desktop-lyrics-control" type="button" aria-label="打开歌词设置" onClick={onOpenSettings}>
          <Settings size={14} />
        </button>
        <button className="desktop-lyrics-control" type="button" aria-label="关闭桌面歌词" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      <p className={payload.isLoading ? "desktop-lyrics-current loading" : "desktop-lyrics-current"}>
        {payload.currentLine ?? "暂无播放"}
      </p>
      {payload.nextLine ? <p className="desktop-lyrics-next">{payload.nextLine}</p> : null}
    </section>
  );
}
