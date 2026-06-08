import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Track } from "../../shared/types";
import { LibraryList } from "./LibraryList";

describe("LibraryList", () => {
  it("virtualizes large song lists while keeping visible rows playable", () => {
    const tracks = Array.from({ length: 500 }, (_, index) => makeTrack(index));
    const onSelectTrack = vi.fn();

    render(
      <LibraryList
        category="songs"
        tracks={tracks}
        currentTrack={null}
        search=""
        selectedFolderPath={null}
        onSearchChange={() => undefined}
        onSelectTrack={onSelectTrack}
        onOpenFolder={() => undefined}
        onBackToFolders={() => undefined}
      />
    );

    expect(screen.getByText("Track 000")).toBeTruthy();
    expect(screen.queryByText("Track 499")).toBeNull();
    expect(screen.getAllByRole("button", { name: /Track \d{3}/ }).length).toBeLessThan(80);

    fireEvent.click(screen.getByRole("button", { name: /Track 000/ }));

    expect(onSelectTrack).toHaveBeenCalledWith(tracks[0]);
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
