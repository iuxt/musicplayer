import type { DesktopLyricsPayload, Track } from "../shared/types";

export interface LyricLine {
  id: string;
  time: number | null;
  text: string;
}

interface DesktopLyricsPayloadInput {
  track: Track | null;
  lyrics: string | null;
  isLyricsLoading: boolean;
  currentTime: number;
  fontFamily: string;
  fontSize: number;
}

export function parseLyrics(lyrics: string | null): LyricLine[] {
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

export function findActiveLine(lines: LyricLine[], currentTime: number): LyricLine | null {
  const activeIndex = findActiveLineIndex(lines, currentTime);
  return activeIndex >= 0 ? lines[activeIndex] : null;
}

export function findActiveLineIndex(lines: LyricLine[], currentTime: number) {
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

export function findNextLine(lines: LyricLine[], activeLine: LyricLine | null): LyricLine | null {
  if (!activeLine) {
    return lines[0] ?? null;
  }

  const activeIndex = lines.findIndex((line) => line.id === activeLine.id);
  if (activeIndex < 0) {
    return null;
  }

  return lines[activeIndex + 1] ?? null;
}

export function buildDesktopLyricsPayload({
  track,
  lyrics,
  isLyricsLoading,
  currentTime,
  fontFamily,
  fontSize
}: DesktopLyricsPayloadInput): DesktopLyricsPayload {
  if (!track) {
    return {
      trackTitle: null,
      artist: null,
      currentLine: "暂无播放",
      nextLine: null,
      isLoading: false,
      fontFamily,
      fontSize
    };
  }

  if (isLyricsLoading) {
    return {
      trackTitle: track.title,
      artist: track.artist,
      currentLine: "正在加载歌词...",
      nextLine: null,
      isLoading: true,
      fontFamily,
      fontSize
    };
  }

  const lines = parseLyrics(lyrics);
  if (lines.length === 0) {
    return {
      trackTitle: track.title,
      artist: track.artist,
      currentLine: track.hasLyrics ? "未找到歌词。" : "未找到歌词。",
      nextLine: null,
      isLoading: false,
      fontFamily,
      fontSize
    };
  }

  const activeLine = findActiveLine(lines, currentTime) ?? lines[0];
  const nextLine = findNextLine(lines, activeLine);

  return {
    trackTitle: track.title,
    artist: track.artist,
    currentLine: activeLine.text,
    nextLine: nextLine?.text ?? null,
    isLoading: false,
    fontFamily,
    fontSize
  };
}
