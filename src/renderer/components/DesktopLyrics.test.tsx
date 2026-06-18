import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DesktopLyricsPayload } from "../../shared/types";
import { DesktopLyrics } from "./DesktopLyrics";

describe("DesktopLyrics", () => {
  it("renders the current and next lyric lines with configured typography", () => {
    render(
      <DesktopLyrics
        payload={{
          trackTitle: "Song",
          artist: "Artist",
          currentLine: "当前歌词",
          nextLine: "下一句歌词",
          isLoading: false,
          fontFamily: "LXGW WenKai",
          fontSize: 30
        }}
        onClose={() => undefined}
        onOpenSettings={() => undefined}
      />
    );

    const surface = screen.getByRole("region", { name: "桌面歌词" });
    expect(screen.getByText("当前歌词")).toBeTruthy();
    expect(screen.getByText("下一句歌词")).toBeTruthy();
    expect((surface as HTMLElement).style.getPropertyValue("--desktop-lyrics-font-family")).toContain("LXGW WenKai");
    expect((surface as HTMLElement).style.getPropertyValue("--desktop-lyrics-font-size")).toBe("30px");
  });

  it("calls close and settings callbacks", () => {
    const onClose = vi.fn();
    const onOpenSettings = vi.fn();

    render(<DesktopLyrics payload={makePayload()} onClose={onClose} onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByRole("button", { name: "关闭桌面歌词" }));
    fireEvent.click(screen.getByRole("button", { name: "打开歌词设置" }));

    expect(onClose).toHaveBeenCalled();
    expect(onOpenSettings).toHaveBeenCalled();
  });
});

function makePayload(): DesktopLyricsPayload {
  return {
    trackTitle: "Song",
    artist: "Artist",
    currentLine: "当前歌词",
    nextLine: null,
    isLoading: false,
    fontFamily: "",
    fontSize: 28
  };
}
