import { describe, expect, it } from "vitest";
import type { Track } from "../shared/types";
import { DEFAULT_DESKTOP_LYRICS_CURRENT_COLOR, DEFAULT_DESKTOP_LYRICS_NEXT_COLOR } from "./appSettings";
import { buildDesktopLyricsPayload, findActiveLine, findNextLine, parseLyrics } from "./lyrics";

describe("lyrics helpers", () => {
  it("parses timed LRC lines and sorts them", () => {
    expect(parseLyrics("[00:10.00]Second\n[00:01.50]First")).toEqual([
      { id: "1-0", time: 1.5, text: "First" },
      { id: "0-0", time: 10, text: "Second" }
    ]);
  });

  it("finds the active and next lyric lines", () => {
    const lines = parseLyrics("[00:01.00]First\n[00:12.50]Current\n[00:30.00]Later");
    const active = findActiveLine(lines, 13);

    expect(active?.text).toBe("Current");
    expect(findNextLine(lines, active)?.text).toBe("Later");
  });

  it("builds a desktop lyrics payload for a timed lyric", () => {
    expect(
      buildDesktopLyricsPayload({
        track: makeTrack({ hasLyrics: true, lyricsPath: "/music/song.lrc" }),
        lyrics: "[00:01.00]First\n[00:12.50]Current\n[00:30.00]Later",
        isLyricsLoading: false,
        currentTime: 13,
        fontFamily: "PingFang SC",
        fontSize: 30,
        currentColor: "#FFCC00",
        nextColor: "#5EEAD4"
      })
    ).toEqual({
      trackTitle: "Song",
      artist: "Artist",
      currentLine: "Current",
      nextLine: "Later",
      isLoading: false,
      fontFamily: "PingFang SC",
      fontSize: 30,
      currentColor: "#FFCC00",
      nextColor: "#5EEAD4"
    });
  });

  it("defaults desktop lyrics payload colors when omitted", () => {
    expect(
      buildDesktopLyricsPayload({
        track: makeTrack({ hasLyrics: true, lyricsPath: "/music/song.lrc" }),
        lyrics: "[00:01.00]Current\n[00:30.00]Later",
        isLyricsLoading: false,
        currentTime: 2,
        fontFamily: "",
        fontSize: 28
      })
    ).toMatchObject({
      currentColor: DEFAULT_DESKTOP_LYRICS_CURRENT_COLOR,
      nextColor: DEFAULT_DESKTOP_LYRICS_NEXT_COLOR
    });
  });

  it("builds loading, no-lyrics, and no-track desktop payloads", () => {
    expect(
      buildDesktopLyricsPayload({
        track: makeTrack({ hasLyrics: true, lyricsPath: "/music/song.lrc" }),
        lyrics: null,
        isLyricsLoading: true,
        currentTime: 0,
        fontFamily: "",
        fontSize: 28,
        currentColor: "#FFFFFF",
        nextColor: "#9CA3AF"
      })
    ).toMatchObject({
      currentLine: "正在加载歌词...",
      isLoading: true,
      currentColor: "#FFFFFF",
      nextColor: "#9CA3AF"
    });

    expect(
      buildDesktopLyricsPayload({
        track: makeTrack({ hasLyrics: false, lyricsPath: null }),
        lyrics: null,
        isLyricsLoading: false,
        currentTime: 0,
        fontFamily: "",
        fontSize: 28,
        currentColor: "#FFFFFF",
        nextColor: "#9CA3AF"
      })
    ).toMatchObject({
      currentLine: "未找到歌词。",
      currentColor: "#FFFFFF",
      nextColor: "#9CA3AF"
    });

    expect(
      buildDesktopLyricsPayload({
        track: null,
        lyrics: null,
        isLyricsLoading: false,
        currentTime: 0,
        fontFamily: "",
        fontSize: 28,
        currentColor: "#FFFFFF",
        nextColor: "#9CA3AF"
      })
    ).toMatchObject({
      currentLine: "暂无播放",
      currentColor: "#FFFFFF",
      nextColor: "#9CA3AF"
    });
  });
});

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: "track-1",
    filePath: "/music/song.flac",
    title: "Song",
    artist: "Artist",
    album: "Album",
    duration: 180,
    trackNumber: null,
    extension: "flac",
    artworkId: null,
    artworkPath: "/music/cover.jpg",
    lyricsPath: "/music/song.lrc",
    hasLyrics: true,
    folderPath: "/music",
    ...overrides
  };
}
