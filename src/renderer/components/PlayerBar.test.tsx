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

    fireEvent.click(screen.getByRole("button", { name: "打开全屏歌词" }));

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

    expect(screen.queryByRole("button", { name: "随机播放" })).toBeNull();
    expect(screen.queryByRole("button", { name: "循环播放" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "播放模式：随机播放" }));

    expect(onPlaybackMode).toHaveBeenCalledOnce();
  });

  it("falls back to the default artwork icon when the mini artwork image cannot load", () => {
    render(
      <PlayerBar
        track={makeTrack()}
        artworkUrl="file:///missing-cover.jpg"
        isPlaying={false}
        currentTime={0}
        duration={180}
        volume={0.8}
        shuffle={false}
        repeat="off"
        onOpenNowPlaying={() => undefined}
        onPlayPause={() => undefined}
        onPrevious={() => undefined}
        onNext={() => undefined}
        onSeek={() => undefined}
        onVolume={() => undefined}
        onPlaybackMode={() => undefined}
      />
    );

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
