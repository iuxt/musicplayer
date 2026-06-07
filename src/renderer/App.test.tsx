import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanResult, Track } from "../shared/types";
import { App } from "./App";

const rememberedFolder = "/Users/test/Music";
const track = makeTrack("wav-1", "Wave Song", "Artist", "Wave Album", "Wave Album");
const folderTrack = makeTrack("mp3-folder", "Artist Folder Song", "Second Artist", "Loose Songs", "Second Artist");
const secondTrack = makeTrack("mp3-1", "Second Song", "Second Artist", "Second Album", "Second Artist/Second Album");
const thirdTrack = makeTrack("mp3-2", "Third Song", "Second Artist", "Second Album", "Second Artist/Second Album");
const scanResult: ScanResult = {
  folderPath: rememberedFolder,
  tracks: [track, folderTrack, secondTrack, thirdTrack],
  warnings: []
};
const libraryCacheKey = "local-music-player:library-cache";

let menuHandler: ((command: "choose-folder" | "rescan-library") => void) | null = null;

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined)
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: vi.fn()
  });
  window.musicApi = {
    chooseMusicFolder: vi.fn(),
    rescanLibrary: vi.fn(async () => scanResult),
    getPlayableUrl: vi.fn(async (filePath: string) => `file://${filePath}`),
    getArtworkUrl: vi.fn(async () => null),
    getLyrics: vi.fn(async () => null),
    onScanProgress: vi.fn(() => () => undefined),
    onMenuCommand: vi.fn((callback) => {
      menuHandler = callback;
      return () => {
        menuHandler = null;
      };
    })
  };
});

describe("App", () => {
  it("loads the cached remembered folder on startup without rescanning", async () => {
    localStorage.setItem("local-music-player:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    expect(window.musicApi.rescanLibrary).not.toHaveBeenCalled();
  });

  it("rescans the remembered folder on startup when no cache exists", async () => {
    localStorage.setItem("local-music-player:last-folder", rememberedFolder);

    render(<App />);

    await waitFor(() => expect(window.musicApi.rescanLibrary).toHaveBeenCalledWith(rememberedFolder));
    await waitFor(() => expect(localStorage.getItem(libraryCacheKey)).toBe(JSON.stringify(scanResult)));
  });

  it("shows the song list without the large now-playing artwork on the main screen", async () => {
    localStorage.setItem("local-music-player:last-folder", rememberedFolder);

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    expect(screen.queryByText("Now Playing")).toBeNull();
  });

  it("remembers a newly chosen folder", async () => {
    window.musicApi.chooseMusicFolder = vi.fn(async () => scanResult);

    render(<App />);
    fireEvent.click(screen.getAllByText("Choose Folder")[0]);

    await waitFor(() => expect(localStorage.getItem("local-music-player:last-folder")).toBe(rememberedFolder));
  });

  it("handles folder actions from menu commands", async () => {
    window.musicApi.chooseMusicFolder = vi.fn(async () => scanResult);

    render(<App />);

    await act(async () => {
      menuHandler?.("choose-folder");
    });

    await waitFor(() => expect(window.musicApi.chooseMusicFolder).toHaveBeenCalled());
    await act(async () => {
      menuHandler?.("rescan-library");
    });

    await waitFor(() => expect(window.musicApi.rescanLibrary).toHaveBeenCalledWith(rememberedFolder));
    expect(localStorage.getItem(libraryCacheKey)).toBe(JSON.stringify(scanResult));
  });

  it("uses the sidebar action area for library categories", async () => {
    localStorage.setItem("local-music-player:last-folder", rememberedFolder);

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    expect(screen.queryByText("Rescan")).toBeNull();
    expect(screen.getByRole("button", { name: "Songs" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Albums" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Artists" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Folders" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Albums" }));
    expect(await screen.findByRole("heading", { name: "Albums" })).toBeTruthy();
    expect(screen.getByText("Wave Album")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Artists" }));
    expect(await screen.findByRole("heading", { name: "Artists" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Library browser" })).getByText("Second Artist")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Folders" }));
    expect(await screen.findByRole("heading", { name: "Folders" })).toBeTruthy();
    const library = screen.getByRole("region", { name: "Library browser" });
    expect(within(library).getByRole("button", { name: /Second Artist.*3 songs.*Open/ })).toBeTruthy();
    expect(within(library).queryByText("Second Artist/Second Album")).toBeNull();
  });

  it("drills into folders one level at a time and shows current-layer songs", async () => {
    localStorage.setItem("local-music-player:last-folder", rememberedFolder);

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: "Folders" }));
    let library = screen.getByRole("region", { name: "Library browser" });
    fireEvent.click(within(library).getByRole("button", { name: /Second Artist.*3 songs.*Open/ }));

    expect(await screen.findByRole("heading", { name: "Second Artist" })).toBeTruthy();
    library = screen.getByRole("region", { name: "Library browser" });
    expect(within(library).getByRole("button", { name: /Second Album.*2 songs.*Open/ })).toBeTruthy();
    expect(within(library).getByText("Artist Folder Song")).toBeTruthy();
    expect(within(library).queryByText("Second Song")).toBeNull();

    fireEvent.click(within(library).getByRole("button", { name: /Second Album.*2 songs.*Open/ }));

    expect(await screen.findByRole("heading", { name: "Second Artist/Second Album" })).toBeTruthy();
    library = screen.getByRole("region", { name: "Library browser" });
    expect(within(library).queryByText("Wave Song")).toBeNull();
    expect(within(library).queryByText("Artist Folder Song")).toBeNull();
    expect(within(library).getByText("Second Song")).toBeTruthy();
    expect(within(library).getByText("Third Song")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "01 Second Song Second Artist Second Album 3:00" }));

    await waitFor(() => expect(window.musicApi.getPlayableUrl).toHaveBeenCalledWith(secondTrack.filePath));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

    const playlist = screen.getByRole("region", { name: "Playlist" });
    expect(within(playlist).getByText("Second Song")).toBeTruthy();
    expect(within(playlist).getByText("Third Song")).toBeTruthy();
    expect(within(playlist).queryByText("Wave Song")).toBeNull();
  });

  it("removes a track from the playlist without removing it from the library", async () => {
    localStorage.setItem("local-music-player:last-folder", rememberedFolder);

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    const playlist = screen.getByRole("region", { name: "Playlist" });

    await act(async () => {
      fireEvent.click(within(playlist).getByRole("button", { name: "Remove Wave Song from playlist" }));
    });

    expect(within(playlist).queryByText("Wave Song")).toBeNull();
    expect(within(screen.getByRole("region", { name: "Library browser" })).getByText("Wave Song")).toBeTruthy();
  });

  it("clears the playlist and keeps the library tracks visible", async () => {
    localStorage.setItem("local-music-player:last-folder", rememberedFolder);

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    const playlist = screen.getByRole("region", { name: "Playlist" });

    await act(async () => {
      fireEvent.click(within(playlist).getByRole("button", { name: "Clear playlist" }));
    });

    expect(within(playlist).getByText("Queue is empty")).toBeTruthy();
    expect(within(playlist).queryByText("Wave Song")).toBeNull();
    expect(within(playlist).queryByText("Second Song")).toBeNull();
    expect(within(screen.getByRole("region", { name: "Library browser" })).getByText("Wave Song")).toBeTruthy();
  });

  it("queues only the selected artist when playing an artist group", async () => {
    localStorage.setItem("local-music-player:last-folder", rememberedFolder);

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "Artists" }));

    const library = screen.getByRole("region", { name: "Library browser" });
    await act(async () => {
      fireEvent.click(within(library).getByRole("button", { name: /Second Artist.*3 songs.*Play/ }));
    });

    const playlist = screen.getByRole("region", { name: "Playlist" });
    expect(within(playlist).getByText("Artist Folder Song")).toBeTruthy();
    expect(within(playlist).getByText("Second Song")).toBeTruthy();
    expect(within(playlist).getByText("Third Song")).toBeTruthy();
    expect(within(playlist).queryByText("Wave Song")).toBeNull();
  });
});

function makeTrack(id: string, title: string, artist: string, album: string, folderPath: string): Track {
  return {
    id,
    filePath: `/music/${title}.wav`,
    title,
    artist,
    album,
    duration: 180,
    trackNumber: null,
    extension: "wav",
    artworkId: null,
    artworkPath: null,
    lyricsPath: null,
    hasLyrics: false,
    folderPath
  };
}
