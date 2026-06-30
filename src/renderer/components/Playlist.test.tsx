import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Track } from "../../shared/types";
import { Playlist } from "./Playlist";

describe("Playlist", () => {
  it("scrolls the queue to keep the current track visible", () => {
    const tracks = Array.from({ length: 150 }, (_, index) => makeTrack(index));
    const { rerender } = render(
      <Playlist
        tracks={tracks}
        currentTrack={tracks[0]}
        label="音乐库"
        onSelectTrack={() => undefined}
        onTrackContextMenu={() => undefined}
        onClear={() => undefined}
        onRemoveTrack={() => undefined}
      />
    );
    const playlistList = document.querySelector(".playlist-list") as HTMLDivElement;

    expect(playlistList.scrollTop).toBe(0);

    rerender(
      <Playlist
        tracks={tracks}
        currentTrack={tracks[120]}
        label="音乐库"
        onSelectTrack={() => undefined}
        onTrackContextMenu={() => undefined}
        onClear={() => undefined}
        onRemoveTrack={() => undefined}
      />
    );

    expect(playlistList.scrollTop).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "121 Track 120 Artist" })).toBeTruthy();
  });

  it("reports context menu requests for queue rows", () => {
    const tracks = [makeTrack(0), makeTrack(1)];
    const onTrackContextMenu = vi.fn();

    render(
      <Playlist
        tracks={tracks}
        currentTrack={null}
        label="音乐库"
        onSelectTrack={() => undefined}
        onTrackContextMenu={onTrackContextMenu}
        onClear={() => undefined}
        onRemoveTrack={() => undefined}
      />
    );

    screen.getByRole("button", { name: "02 Track 001 Artist" }).dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        clientX: 24,
        clientY: 48
      })
    );

    expect(onTrackContextMenu).toHaveBeenCalledWith(tracks[1], { x: 24, y: 48 });
  });
});

function makeTrack(index: number): Track {
  return {
    id: `track-${index}`,
    filePath: `/music/Track ${index}.flac`,
    title: `Track ${String(index).padStart(3, "0")}`,
    artist: "Artist",
    album: "Album",
    duration: 180,
    trackNumber: null,
    extension: "flac",
    artworkId: null,
    artworkPath: null,
    lyricsPath: null,
    hasLyrics: false,
    folderPath: "Artist/Album"
  };
}
