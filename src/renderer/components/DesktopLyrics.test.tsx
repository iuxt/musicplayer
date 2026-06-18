import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
      />
    );

    const surface = screen.getByRole("region", { name: "桌面歌词" });
    expect(screen.getByText("当前歌词")).toBeTruthy();
    expect(screen.getByText("下一句歌词")).toBeTruthy();
    expect((surface as HTMLElement).style.getPropertyValue("--desktop-lyrics-font-family")).toContain("LXGW WenKai");
    expect((surface as HTMLElement).style.getPropertyValue("--desktop-lyrics-font-size")).toBe("30px");
  });

  it("renders only lyric text without visible window controls", () => {
    render(<DesktopLyrics payload={makePayload()} />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("当前歌词").closest(".desktop-lyrics-text")).toBeTruthy();
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
