import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../../shared/types";
import { FullscreenLyrics } from "./FullscreenLyrics";

const track = makeTrack();

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("FullscreenLyrics", () => {
  it("highlights the lyric line matching the current playback time", () => {
    render(
      <FullscreenLyrics
        track={track}
        artworkUrl="file:///cover.jpg"
        lyrics={"[00:01.00]First line\n[00:12.50]Current line\n[00:30.00]Later line"}
        isLyricsLoading={false}
        currentTime={13}
        fullscreenLyricsFontFamily="PingFang SC"
        fullscreenLyricsFontSize={36}
        onClose={() => undefined}
      />
    );

    expect(screen.getByText("Current line").className).toContain("active");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("applies the configured fullscreen lyrics font family and size", () => {
    render(
      <FullscreenLyrics
        track={track}
        artworkUrl="file:///cover.jpg"
        lyrics={"[00:01.00]Custom size line"}
        isLyricsLoading={false}
        currentTime={2}
        fullscreenLyricsFontFamily="PingFang SC"
        fullscreenLyricsFontSize={48}
        onClose={() => undefined}
      />
    );

    const fullscreenLyrics = screen.getByRole("region", { name: "全屏歌词" });
    expect((fullscreenLyrics as HTMLElement).style.getPropertyValue("--fullscreen-lyrics-font-family")).toContain("PingFang SC");
    expect((fullscreenLyrics as HTMLElement).style.getPropertyValue("--fullscreen-lyrics-font-size")).toBe("48px");
  });
});

function makeTrack(): Track {
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
    folderPath: "/music"
  };
}
