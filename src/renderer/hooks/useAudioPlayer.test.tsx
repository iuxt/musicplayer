import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../../shared/types";
import { useAudioPlayer } from "./useAudioPlayer";

const tracks: Track[] = [
  makeTrack("a", "Alpha"),
  makeTrack("b", "Beta"),
  makeTrack("c", "Gamma")
];

let createdAudioElements: HTMLAudioElement[] = [];

beforeEach(() => {
  createdAudioElements = [];
  vi.stubGlobal(
    "Audio",
    vi.fn(() => {
      const audio = document.createElement("audio");
      createdAudioElements.push(audio);
      return audio;
    })
  );
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined)
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: vi.fn()
  });
  Object.defineProperty(HTMLMediaElement.prototype, "load", {
    configurable: true,
    value: vi.fn()
  });

  window.musicApi = {
    chooseMusicFolder: vi.fn(),
    rescanLibrary: vi.fn(),
    getPlayableUrl: vi.fn(async (filePath: string) => `file://${filePath}`),
    getArtworkUrl: vi.fn(),
    getLyrics: vi.fn(),
    showTrackInFolder: vi.fn(),
    updateTrackMetadata: vi.fn(),
    trashTrackLyrics: vi.fn(),
    trashTrackFiles: vi.fn(),
    listSystemFonts: vi.fn(),
    showDesktopLyrics: vi.fn(),
    closeDesktopLyrics: vi.fn(),
    updateDesktopLyrics: vi.fn(),
    resizeDesktopLyrics: vi.fn(),
    openMainSettingsFromDesktopLyrics: vi.fn(),
    ensureSystemMediaShortcutsPermission: vi.fn(),
    setSystemMediaShortcutsEnabled: vi.fn(),
    setCloseWindowStopsPlayback: vi.fn(),
    onDesktopLyricsUpdate: vi.fn(),
    onDesktopLyricsClosed: vi.fn(),
    onScanProgress: vi.fn(),
    onMenuCommand: vi.fn(),
    onMediaKeyCommand: vi.fn()
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

  it("restores a track at a requested time without playing", async () => {
    const { result } = renderHook(() => useAudioPlayer(tracks));

    await act(async () => {
      await result.current.restoreTrack(tracks[1], 37);
    });

    expect(window.musicApi.getPlayableUrl).toHaveBeenCalledWith(tracks[1].filePath);
    expect(result.current.currentTrack?.title).toBe("Beta");
    expect(result.current.currentTime).toBe(37);
    expect(result.current.isPlaying).toBe(false);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it("auto-advances to the next loaded queue track when playback ends", async () => {
    const { result, rerender } = renderHook(({ queue }) => useAudioPlayer(queue), {
      initialProps: { queue: [] as Track[] }
    });

    rerender({ queue: tracks });

    await act(async () => {
      await result.current.playTrack(tracks[0]);
    });

    await act(async () => {
      createdAudioElements[0].dispatchEvent(new Event("ended"));
    });

    await waitFor(() => expect(result.current.currentTrack?.title).toBe("Beta"));
    expect(window.musicApi.getPlayableUrl).toHaveBeenLastCalledWith(tracks[1].filePath);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
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

  it("initializes playback preferences from saved values", () => {
    const { result } = renderHook(() => useAudioPlayer(tracks, { volume: 0.35, shuffle: true, repeat: "all" }));

    expect(result.current.volume).toBe(0.35);
    expect(result.current.shuffle).toBe(true);
    expect(result.current.repeat).toBe("all");
    expect(createdAudioElements[0].volume).toBe(0.35);
  });

  it("returns normalized values when mutating playback preferences", () => {
    const { result } = renderHook(() => useAudioPlayer(tracks, { volume: 0.35, shuffle: false, repeat: "off" }));

    act(() => {
      expect(result.current.setVolume(2)).toBe(1);
    });
    expect(result.current.volume).toBe(1);
    expect(createdAudioElements[0].volume).toBe(1);

    act(() => {
      expect(result.current.cyclePlaybackMode()).toEqual({ shuffle: true, repeat: "off" });
    });
    expect(result.current.shuffle).toBe(true);
    expect(result.current.repeat).toBe("off");
  });

  it("stops playback and clears the current track", async () => {
    const { result } = renderHook(() => useAudioPlayer(tracks));

    await act(async () => {
      await result.current.playTrack(tracks[0]);
    });
    act(() => {
      result.current.stop();
    });

    expect(result.current.currentTrack).toBeNull();
    expect(result.current.currentTime).toBe(0);
    expect(result.current.duration).toBe(0);
    expect(result.current.isPlaying).toBe(false);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("replaces the current track metadata without reloading audio", async () => {
    const { result } = renderHook(() => useAudioPlayer(tracks));

    await act(async () => {
      await result.current.selectTrack(tracks[0]);
    });
    act(() => {
      result.current.replaceCurrentTrack({ ...tracks[0], title: "Edited Alpha" });
    });

    expect(result.current.currentTrack?.title).toBe("Edited Alpha");
    expect(window.musicApi.getPlayableUrl).toHaveBeenCalledTimes(1);
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
