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
        onTrackContextMenu={() => undefined}
      />
    );

    expect(screen.getByText("Track 000")).toBeTruthy();
    expect(screen.queryByText("Track 499")).toBeNull();
    expect(screen.getAllByRole("button", { name: /Track \d{3}/ }).length).toBeLessThan(80);

    fireEvent.click(screen.getByRole("button", { name: /Track 000/ }));

    expect(onSelectTrack).toHaveBeenCalledWith(tracks[0]);
  });

  it("reports context menu requests for concrete track rows", () => {
    const tracks = [makeTrack(1), makeTrack(2)];
    const onTrackContextMenu = vi.fn();

    render(
      <LibraryList
        category="songs"
        tracks={tracks}
        currentTrack={null}
        search=""
        selectedFolderPath={null}
        onSearchChange={() => undefined}
        onSelectTrack={() => undefined}
        onOpenFolder={() => undefined}
        onBackToFolders={() => undefined}
        onTrackContextMenu={onTrackContextMenu}
      />
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: /Track 001/ }), { clientX: 24, clientY: 48 });

    expect(onTrackContextMenu).toHaveBeenCalledWith(tracks[0], { x: 24, y: 48 });
  });

  it("shows track artwork before the song title when artwork exists", async () => {
    const track = makeTrack(1, { artworkPath: "/music/cover.jpg" });
    const getArtworkUrl = vi.fn(async (filePath: string | null) => (filePath ? `file://${filePath}` : null));
    Object.defineProperty(window, "musicApi", {
      configurable: true,
      value: { getArtworkUrl }
    });

    render(
      <LibraryList
        category="songs"
        tracks={[track]}
        currentTrack={null}
        search=""
        selectedFolderPath={null}
        onSearchChange={() => undefined}
        onSelectTrack={() => undefined}
        onOpenFolder={() => undefined}
        onBackToFolders={() => undefined}
        onTrackContextMenu={() => undefined}
      />
    );

    const artwork = await screen.findByRole("img", { name: "Album 封面" });
    expect(artwork.getAttribute("src")).toBe("file:///music/cover.jpg");
    expect(getArtworkUrl).toHaveBeenCalledWith("/music/cover.jpg");
  });

  it("falls back to the default artwork icon when an artwork image cannot load", async () => {
    const track = makeTrack(1, { artworkPath: "/music/missing-cover.jpg" });
    const getArtworkUrl = vi.fn(async (filePath: string | null) => (filePath ? `file://${filePath}` : null));
    Object.defineProperty(window, "musicApi", {
      configurable: true,
      value: { getArtworkUrl }
    });

    render(
      <LibraryList
        category="songs"
        tracks={[track]}
        currentTrack={null}
        search=""
        selectedFolderPath={null}
        onSearchChange={() => undefined}
        onSelectTrack={() => undefined}
        onOpenFolder={() => undefined}
        onBackToFolders={() => undefined}
        onTrackContextMenu={() => undefined}
      />
    );

    fireEvent.error(await screen.findByRole("img", { name: "Album 封面" }));

    expect(screen.queryByRole("img", { name: "Album 封面" })).toBeNull();
  });

  it("shows album artwork from the first album track with artwork", async () => {
    const tracks = [
      makeTrack(1, { artworkPath: null }),
      makeTrack(2, { artworkPath: "/music/album-cover.jpg" })
    ];
    const getArtworkUrl = vi.fn(async (filePath: string | null) => (filePath ? `file://${filePath}` : null));
    Object.defineProperty(window, "musicApi", {
      configurable: true,
      value: { getArtworkUrl }
    });

    render(
      <LibraryList
        category="albums"
        tracks={tracks}
        currentTrack={null}
        search=""
        selectedFolderPath={null}
        onSearchChange={() => undefined}
        onSelectTrack={() => undefined}
        onOpenFolder={() => undefined}
        onBackToFolders={() => undefined}
        onTrackContextMenu={() => undefined}
      />
    );

    const artwork = await screen.findByRole("img", { name: "Album 封面" });
    expect(artwork.getAttribute("src")).toBe("file:///music/album-cover.jpg");
    expect(getArtworkUrl).toHaveBeenCalledWith("/music/album-cover.jpg");
  });

  it("shows an artist icon thumbnail before artist group titles", () => {
    render(
      <LibraryList
        category="artists"
        tracks={[makeTrack(1, { artist: "Artist One" })]}
        currentTrack={null}
        search=""
        selectedFolderPath={null}
        onSearchChange={() => undefined}
        onSelectTrack={() => undefined}
        onOpenFolder={() => undefined}
        onBackToFolders={() => undefined}
        onTrackContextMenu={() => undefined}
      />
    );

    const artistIcon = screen.getByRole("img", { name: "歌手" });

    expect(artistIcon.classList.contains("category-icon-thumbnail")).toBe(true);
    expect(screen.getByRole("button", { name: /Artist One.*1 首歌曲.*播放/ })).toBeTruthy();
  });

  it("shows a folder icon thumbnail before folder titles", () => {
    render(
      <LibraryList
        category="folders"
        tracks={[makeTrack(1, { folderPath: "Artist One/Album One" })]}
        currentTrack={null}
        search=""
        selectedFolderPath={null}
        onSearchChange={() => undefined}
        onSelectTrack={() => undefined}
        onOpenFolder={() => undefined}
        onBackToFolders={() => undefined}
        onTrackContextMenu={() => undefined}
      />
    );

    const folderIcon = screen.getByRole("img", { name: "文件夹" });

    expect(folderIcon.classList.contains("category-icon-thumbnail")).toBe(true);
    expect(screen.getByRole("button", { name: /Artist One.*1 首歌曲.*打开/ })).toBeTruthy();
  });
});

function makeTrack(index: number, overrides: Partial<Track> = {}): Track {
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
    folderPath: "Artist/Album",
    ...overrides
  };
}
