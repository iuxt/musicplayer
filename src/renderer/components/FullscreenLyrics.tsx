import { Disc3, X } from "lucide-react";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { Track } from "../../shared/types";

interface FullscreenLyricsProps {
  track: Track | null;
  artworkUrl: string | null;
  lyrics: string | null;
  isLyricsLoading: boolean;
  currentTime: number;
  fullscreenLyricsFontSize: number;
  onClose: () => void;
}

interface LyricLine {
  id: string;
  time: number | null;
  text: string;
}

export function FullscreenLyrics({
  track,
  artworkUrl,
  lyrics,
  isLyricsLoading,
  currentTime,
  fullscreenLyricsFontSize,
  onClose
}: FullscreenLyricsProps) {
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const lines = useMemo(() => parseLyrics(lyrics), [lyrics]);
  const activeIndex = useMemo(() => findActiveLine(lines, currentTime), [currentTime, lines]);
  const lyricsStyle = {
    "--fullscreen-lyrics-font-size": `${fullscreenLyricsFontSize}px`
  } as CSSProperties & Record<"--fullscreen-lyrics-font-size", string>;

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
    <section className="fullscreen-lyrics" aria-label="Fullscreen lyrics" style={lyricsStyle}>
      <button className="fullscreen-close" type="button" aria-label="Close fullscreen lyrics" onClick={onClose}>
        <X size={24} />
      </button>

      <div className="fullscreen-artwork-column">
        <div className="fullscreen-cover-frame">
          {artworkUrl ? (
            <img className="cover-image" src={artworkUrl} alt={track ? `${track.album} cover` : "Album cover"} />
          ) : (
            <div className="cover-art">
              <Disc3 size={112} />
            </div>
          )}
        </div>
        <div className="fullscreen-track-copy">
          <p className="eyebrow">Now Playing</p>
          <h2>{track?.title ?? "Nothing playing"}</h2>
          <p>{track ? `${track.artist} - ${track.album}` : "Choose a track to start."}</p>
        </div>
      </div>

      <div className="fullscreen-lyrics-column" aria-live="polite">
        {isLyricsLoading ? (
          <p className="fullscreen-lyrics-empty">Loading lyrics...</p>
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
          <p className="fullscreen-lyrics-empty">{track ? "No lyrics found." : "Lyrics will appear here."}</p>
        )}
      </div>
    </section>
  );
}

function parseLyrics(lyrics: string | null): LyricLine[] {
  if (!lyrics) {
    return [];
  }

  return lyrics
    .split(/\r?\n/)
    .flatMap<LyricLine>((line, index) => {
      const timestamps = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
      const text = line.replace(/\[[^\]]+\]/g, "").trim();
      if (!text) {
        return [];
      }
      if (timestamps.length === 0) {
        return [{ id: `plain-${index}`, time: null, text }];
      }
      return timestamps.map<LyricLine>((match, timestampIndex) => ({
        id: `${index}-${timestampIndex}`,
        time: Number(match[1]) * 60 + Number(match[2]) + Number(`0.${(match[3] ?? "0").padEnd(3, "0")}`),
        text
      }));
    })
    .sort((left, right) => (left.time ?? Number.MAX_SAFE_INTEGER) - (right.time ?? Number.MAX_SAFE_INTEGER));
}

function findActiveLine(lines: LyricLine[], currentTime: number) {
  let activeIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const time = lines[index].time;
    if (time === null || time > currentTime) {
      break;
    }
    activeIndex = index;
  }

  return activeIndex;
}
