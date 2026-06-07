import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../../shared/types";
import { useAudioPlayer } from "./useAudioPlayer";

const tracks: Track[] = [
  makeTrack("a", "Alpha"),
  makeTrack("b", "Beta"),
  makeTrack("c", "Gamma")
];

beforeEach(() => {
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined)
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: vi.fn()
  });

  window.musicApi = {
    chooseMusicFolder: vi.fn(),
    rescanLibrary: vi.fn(),
    getPlayableUrl: vi.fn(async (filePath: string) => `file://${filePath}`),
    getArtworkUrl: vi.fn(),
    getLyrics: vi.fn(),
    onScanProgress: vi.fn(),
    onMenuCommand: vi.fn()
  };
});

describe("useAudioPlayer", () => {
  it("selects a track and advances through the queue", async () => {
    const { result } = renderHook(() => useAudioPlayer(tracks));

    await act(async () => {
      await result.current.selectTrack(tracks[0]);
    });

    expect(result.current.currentTrack?.title).toBe("Alpha");

    await act(async () => {
      await result.current.next();
    });

    expect(result.current.currentTrack?.title).toBe("Beta");

    await act(async () => {
      await result.current.previous();
    });

    expect(result.current.currentTrack?.title).toBe("Alpha");
  });

  it("cycles playback mode through shuffle, repeat all, repeat one, and off", () => {
    const { result } = renderHook(() => useAudioPlayer(tracks));

    act(() => {
      result.current.cyclePlaybackMode();
    });

    expect(result.current.shuffle).toBe(true);
    expect(result.current.repeat).toBe("off");

    act(() => {
      result.current.cyclePlaybackMode();
    });

    expect(result.current.shuffle).toBe(false);
    expect(result.current.repeat).toBe("all");

    act(() => {
      result.current.cyclePlaybackMode();
    });

    expect(result.current.shuffle).toBe(false);
    expect(result.current.repeat).toBe("one");

    act(() => {
      result.current.cyclePlaybackMode();
    });

    expect(result.current.shuffle).toBe(false);
    expect(result.current.repeat).toBe("off");
  });
});

function makeTrack(id: string, title: string): Track {
  return {
    id,
    filePath: `/music/${title}.mp3`,
    title,
    artist: "Artist",
    album: "Album",
    duration: 180,
    trackNumber: null,
    extension: "mp3",
    artworkId: null,
    artworkPath: null,
    lyricsPath: null,
    hasLyrics: false,
    folderPath: ""
  };
}
