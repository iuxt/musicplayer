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
        onClose={() => undefined}
      />
    );

    expect(screen.getByText("Current line").className).toContain("active");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
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
