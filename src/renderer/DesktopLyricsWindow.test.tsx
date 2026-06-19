import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DesktopLyricsPayload } from "../shared/types";
import { DesktopLyricsWindow } from "./DesktopLyricsWindow";

let updateHandler: ((payload: DesktopLyricsPayload) => void) | null = null;
let resizeObserverCallback: ResizeObserverCallback | null = null;

beforeEach(() => {
  updateHandler = null;
  resizeObserverCallback = null;
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn((callback: ResizeObserverCallback) => {
      resizeObserverCallback = callback;
      return {
        disconnect: vi.fn(),
        observe: vi.fn(),
        unobserve: vi.fn()
      };
    })
  );

  window.musicApi = {
    chooseMusicFolder: vi.fn(),
    rescanLibrary: vi.fn(),
    getPlayableUrl: vi.fn(),
    getArtworkUrl: vi.fn(),
    getLyrics: vi.fn(),
    showTrackInFolder: vi.fn(),
    updateTrackMetadata: vi.fn(),
    trashTrackLyrics: vi.fn(),
    trashTrackFiles: vi.fn(),
    listSystemFonts: vi.fn(async () => []),
    showDesktopLyrics: vi.fn(async () => undefined),
    closeDesktopLyrics: vi.fn(async () => undefined),
    updateDesktopLyrics: vi.fn(async () => undefined),
    resizeDesktopLyrics: vi.fn(async () => undefined),
    openMainSettingsFromDesktopLyrics: vi.fn(async () => undefined),
    setSystemMediaShortcutsEnabled: vi.fn(async () => true),
    onDesktopLyricsUpdate: vi.fn((callback) => {
      updateHandler = callback;
      return () => {
        updateHandler = null;
      };
    }),
    onDesktopLyricsClosed: vi.fn(() => () => undefined),
    onScanProgress: vi.fn(() => () => undefined),
    onMenuCommand: vi.fn(() => () => undefined),
    onMediaKeyCommand: vi.fn(() => () => undefined)
  };
});

describe("DesktopLyricsWindow", () => {
  it("renders updates received from the desktop lyrics channel", () => {
    render(<DesktopLyricsWindow />);

    act(() => {
      updateHandler?.({
        trackTitle: "Song",
        artist: "Artist",
        currentLine: "同步歌词",
        nextLine: "下一句",
        isLoading: false,
        fontFamily: "",
        fontSize: 28
      });
    });

    expect(screen.getByText("同步歌词")).toBeTruthy();
    expect(screen.getByText("下一句")).toBeTruthy();
  });

  it("resizes the transparent window to the lyric text bounds", () => {
    render(<DesktopLyricsWindow />);

    const surface = screen.getByRole("region", { name: "桌面歌词" });
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 248.2,
      height: 72.6,
      top: 0,
      right: 248.2,
      bottom: 72.6,
      left: 0,
      toJSON: () => ({})
    });

    act(() => {
      resizeObserverCallback?.([], {} as ResizeObserver);
    });

    expect(window.musicApi.resizeDesktopLyrics).toHaveBeenCalledWith(249, 73);
  });
});
