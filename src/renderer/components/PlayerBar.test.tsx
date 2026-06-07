import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Track } from "../../shared/types";
import { PlayerBar } from "./PlayerBar";

describe("PlayerBar", () => {
  it("opens the fullscreen lyrics view from the current track artwork", () => {
    const onOpenNowPlaying = vi.fn();

    render(
      <PlayerBar
        track={makeTrack()}
        artworkUrl="file:///cover.jpg"
        isPlaying={false}
        currentTime={0}
        duration={180}
        volume={0.8}
        shuffle={false}
        repeat="off"
        onOpenNowPlaying={onOpenNowPlaying}
        onPlayPause={() => undefined}
        onPrevious={() => undefined}
        onNext={() => undefined}
        onSeek={() => undefined}
        onVolume={() => undefined}
        onPlaybackMode={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open fullscreen lyrics" }));

    expect(onOpenNowPlaying).toHaveBeenCalledOnce();
  });

  it("uses one button to cycle shuffle and repeat modes", () => {
    const onPlaybackMode = vi.fn();

    render(
      <PlayerBar
        track={makeTrack()}
        artworkUrl={null}
        isPlaying={false}
        currentTime={0}
        duration={180}
        volume={0.8}
        shuffle={true}
        repeat="off"
        onOpenNowPlaying={() => undefined}
        onPlayPause={() => undefined}
        onPrevious={() => undefined}
        onNext={() => undefined}
        onSeek={() => undefined}
        onVolume={() => undefined}
        onPlaybackMode={onPlaybackMode}
      />
    );

    expect(screen.queryByRole("button", { name: "Shuffle" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Repeat" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Playback mode: shuffle" }));

    expect(onPlaybackMode).toHaveBeenCalledOnce();
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
