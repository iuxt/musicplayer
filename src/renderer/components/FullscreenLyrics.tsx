import { X } from "lucide-react";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { Track } from "../../shared/types";
import { findActiveLineIndex, parseLyrics } from "../lyrics";
import { ArtworkImage } from "./ArtworkImage";

interface FullscreenLyricsProps {
  track: Track | null;
  artworkUrl: string | null;
  lyrics: string | null;
  isLyricsLoading: boolean;
  currentTime: number;
  fullscreenLyricsFontFamily: string;
  fullscreenLyricsFontSize: number;
  onClose: () => void;
}

export function FullscreenLyrics({
  track,
  artworkUrl,
  lyrics,
  isLyricsLoading,
  currentTime,
  fullscreenLyricsFontFamily,
  fullscreenLyricsFontSize,
  onClose
}: FullscreenLyricsProps) {
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const lines = useMemo(() => parseLyrics(lyrics), [lyrics]);
  const activeIndex = useMemo(() => findActiveLineIndex(lines, currentTime), [currentTime, lines]);
  const lyricsStyle = {
    "--fullscreen-lyrics-font-family": fullscreenLyricsFontFamily
      ? `"${fullscreenLyricsFontFamily}", ui-sans-serif, system-ui, sans-serif`
      : "ui-sans-serif, system-ui, sans-serif",
    "--fullscreen-lyrics-font-size": `${fullscreenLyricsFontSize}px`
  } as CSSProperties & Record<"--fullscreen-lyrics-font-family" | "--fullscreen-lyrics-font-size", string>;

  useEffect(() => {
    activeLineRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <section className="fullscreen-lyrics" aria-label="全屏歌词" style={lyricsStyle}>
      <button className="fullscreen-close" type="button" aria-label="关闭全屏歌词" onClick={onClose}>
        <X size={24} />
      </button>

      <div className="fullscreen-artwork-column">
        <div className="fullscreen-cover-frame">
          <ArtworkImage
            artworkUrl={artworkUrl}
            alt={track ? `${track.album} 封面` : "专辑封面"}
            imageClassName="cover-image"
            fallbackClassName="cover-art"
            iconSize={112}
          />
        </div>
        <div className="fullscreen-track-copy">
          <p className="eyebrow">正在播放</p>
          <h2>{track?.title ?? "暂无播放"}</h2>
          <p>{track ? `${track.artist} - ${track.album}` : "选择歌曲开始播放。"}</p>
        </div>
      </div>

      <div className="fullscreen-lyrics-column" aria-live="polite">
        {isLyricsLoading ? (
          <p className="fullscreen-lyrics-empty">正在加载歌词...</p>
        ) : lines.length > 0 ? (
          <div className="fullscreen-lyrics-list">
            {lines.map((line, index) => (
              <div
                className={index === activeIndex ? "fullscreen-lyric-line active" : "fullscreen-lyric-line"}
                key={line.id}
                ref={index === activeIndex ? activeLineRef : null}
              >
                {line.text}
              </div>
            ))}
          </div>
        ) : (
          <p className="fullscreen-lyrics-empty">{track ? "未找到歌词。" : "歌词会显示在这里。"}</p>
        )}
      </div>
    </section>
  );
}
