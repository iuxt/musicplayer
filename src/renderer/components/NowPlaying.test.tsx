import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Track } from "../../shared/types";
import { NowPlaying } from "./NowPlaying";

describe("NowPlaying", () => {
  it("falls back to the default artwork when the large artwork image cannot load", () => {
    render(<NowPlaying track={makeTrack()} artworkUrl="file:///missing-cover.jpg" playbackError={null} />);

    fireEvent.error(screen.getByRole("img", { name: "Album 封面" }));

    expect(screen.queryByRole("img", { name: "Album 封面" })).toBeNull();
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
