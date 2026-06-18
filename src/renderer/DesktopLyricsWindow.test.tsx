import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DesktopLyricsPayload } from "../shared/types";
import { DesktopLyricsWindow } from "./DesktopLyricsWindow";

let updateHandler: ((payload: DesktopLyricsPayload) => void) | null = null;

beforeEach(() => {
  updateHandler = null;
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
    openMainSettingsFromDesktopLyrics: vi.fn(async () => undefined),
    onDesktopLyricsUpdate: vi.fn((callback) => {
      updateHandler = callback;
      return () => {
        updateHandler = null;
      };
    }),
    onDesktopLyricsClosed: vi.fn(() => () => undefined),
    onScanProgress: vi.fn(() => () => undefined),
    onMenuCommand: vi.fn(() => () => undefined)
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

  it("delegates close and settings actions to preload APIs", () => {
    render(<DesktopLyricsWindow />);
    fireEvent.click(screen.getByRole("button", { name: "打开歌词设置" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭桌面歌词" }));

    expect(window.musicApi.openMainSettingsFromDesktopLyrics).toHaveBeenCalled();
    expect(window.musicApi.closeDesktopLyrics).toHaveBeenCalled();
  });
});
