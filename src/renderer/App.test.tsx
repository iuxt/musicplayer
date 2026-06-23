import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanResult, Track, TrashTrackFilesResult } from "../shared/types";
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
const libraryCacheKey = "musicplayer:library-cache";
const playbackStateKey = "musicplayer:playback-state";
const appSettingsKey = "musicplayer:settings";

let menuHandler: ((command: "choose-folder" | "rescan-library" | "open-settings") => void) | null = null;
let mediaKeyHandler: ((command: "play-pause" | "next" | "previous") => void) | null = null;
let desktopLyricsClosedHandler: (() => void) | null = null;
let createdAudioElements: HTMLAudioElement[] = [];

beforeEach(() => {
  localStorage.clear();
  createdAudioElements = [];
  mediaKeyHandler = null;
  desktopLyricsClosedHandler = null;
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "Audio",
    vi.fn(() => {
      const audio = document.createElement("audio");
      createdAudioElements.push(audio);
      return audio;
    })
  );
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
    showTrackInFolder: vi.fn(async () => ({ ok: true as const })),
    updateTrackMetadata: vi.fn(async (_filePath, metadata) => ({ ok: true as const, metadata: { ...metadata, duration: 180 } })),
    trashTrackLyrics: vi.fn(async () => ({ ok: true as const })),
    trashTrackFiles: vi.fn(async () => ({ ok: true, audioRemoved: true, trashed: [], failed: [], error: null })),
    listSystemFonts: vi.fn(async () => ["", "PingFang SC", "LXGW WenKai"]),
    showDesktopLyrics: vi.fn(async () => undefined),
    closeDesktopLyrics: vi.fn(async () => undefined),
    updateDesktopLyrics: vi.fn(async () => undefined),
    resizeDesktopLyrics: vi.fn(async () => undefined),
    openMainSettingsFromDesktopLyrics: vi.fn(async () => undefined),
    ensureSystemMediaShortcutsPermission: vi.fn(async () => ({ ok: true as const })),
    setSystemMediaShortcutsEnabled: vi.fn(async () => ({ ok: true as const })),
    setCloseWindowStopsPlayback: vi.fn(async () => undefined),
    onDesktopLyricsUpdate: vi.fn(() => () => undefined),
    onDesktopLyricsClosed: vi.fn((callback) => {
      desktopLyricsClosedHandler = callback;
      return () => {
        desktopLyricsClosedHandler = null;
      };
    }),
    onScanProgress: vi.fn(() => () => undefined),
    onMenuCommand: vi.fn((callback) => {
      menuHandler = callback;
      return () => {
        menuHandler = null;
      };
    }),
    onMediaKeyCommand: vi.fn((callback) => {
      mediaKeyHandler = callback;
      return () => {
        mediaKeyHandler = null;
      };
    })
  };
});

describe("App", () => {
  it("renders a dedicated window drag region at the top of the app", async () => {
    render(<App />);

    await waitFor(() => expect(window.musicApi.listSystemFonts).toHaveBeenCalled());
    expect(document.querySelector(".window-drag-region")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("loads the cached remembered folder on startup without rescanning", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    expect(window.musicApi.rescanLibrary).not.toHaveBeenCalled();
  });

  it("rescans cached libraries that still point to legacy temporary artwork files", async () => {
    const legacyCachedResult: ScanResult = {
      ...scanResult,
      tracks: [
        {
          ...track,
          artworkId: "legacy-artwork",
          artworkPath: "/var/folders/musicplayer-artwork/legacy-cover.jpg"
        }
      ]
    };
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(legacyCachedResult));

    render(<App />);

    await waitFor(() => expect(window.musicApi.rescanLibrary).toHaveBeenCalledWith(rememberedFolder));
    await waitFor(() => expect(localStorage.getItem(libraryCacheKey)).toBe(JSON.stringify(scanResult)));
  });

  it("rescans the remembered folder on startup when no cache exists", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);

    render(<App />);

    await waitFor(() => expect(window.musicApi.rescanLibrary).toHaveBeenCalledWith(rememberedFolder));
    await waitFor(() => expect(localStorage.getItem(libraryCacheKey)).toBe(JSON.stringify(scanResult)));
  });

  it("restores the last played track and position on startup without autoplaying", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    localStorage.setItem(
      playbackStateKey,
      JSON.stringify({
        trackId: secondTrack.id,
        currentTime: 42,
        queueTrackIds: [secondTrack.id, thirdTrack.id],
        isPlayQueueExplicit: true,
        playlistLabel: "Second Artist/Second Album"
      })
    );

    render(<App />);

    await waitFor(() => expect(window.musicApi.getPlayableUrl).toHaveBeenCalledWith(secondTrack.filePath));
    await waitFor(() => expect(screen.getByText("0:42")).toBeTruthy());
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    const playlist = screen.getByRole("region", { name: "播放列表" });
    expect(within(playlist).getByText("Second Song")).toBeTruthy();
    expect(within(playlist).getByText("Third Song")).toBeTruthy();
    expect(within(playlist).queryByText("Wave Song")).toBeNull();
  });

  it("throttles playback progress persistence while a track is playing", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    });

    await waitFor(() => expect(window.musicApi.getPlayableUrl).toHaveBeenCalledWith(track.filePath));
    await waitFor(() => expect(playbackStateWriteCount(setItemSpy)).toBeGreaterThan(0));
    const writesAfterTrackSelection = playbackStateWriteCount(setItemSpy);
    const audio = createdAudioElements[0];

    await act(async () => {
      audio.currentTime = 1;
      audio.dispatchEvent(new Event("timeupdate"));
    });
    await waitFor(() => expect(screen.getByText("0:01")).toBeTruthy());
    await act(async () => {
      audio.currentTime = 2;
      audio.dispatchEvent(new Event("timeupdate"));
    });
    await waitFor(() => expect(screen.getByText("0:02")).toBeTruthy());
    await act(async () => {
      audio.currentTime = 3;
      audio.dispatchEvent(new Event("timeupdate"));
    });
    await waitFor(() => expect(screen.getByText("0:03")).toBeTruthy());

    expect(playbackStateWriteCount(setItemSpy) - writesAfterTrackSelection).toBeLessThanOrEqual(1);
  });

  it("advances to the next playlist track when the current track ends", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    });

    await waitFor(() => expect(window.musicApi.getPlayableUrl).toHaveBeenCalledWith(track.filePath));
    const audio = createdAudioElements[createdAudioElements.length - 1];

    await act(async () => {
      audio.dispatchEvent(new Event("ended"));
    });

    await waitFor(() => expect(window.musicApi.getPlayableUrl).toHaveBeenLastCalledWith(folderTrack.filePath));
    expect(within(screen.getByRole("contentinfo")).getByText("Artist Folder Song")).toBeTruthy();
    expect(screen.getByRole("button", { name: "暂停" })).toBeTruthy();
  });

  it("advances when playback reaches the track duration without an ended event", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    });

    await waitFor(() => expect(window.musicApi.getPlayableUrl).toHaveBeenCalledWith(track.filePath));
    const audio = createdAudioElements[createdAudioElements.length - 1];
    Object.defineProperty(audio, "duration", {
      configurable: true,
      value: track.duration
    });

    await act(async () => {
      audio.currentTime = track.duration;
      audio.dispatchEvent(new Event("timeupdate"));
    });

    await waitFor(() => expect(window.musicApi.getPlayableUrl).toHaveBeenLastCalledWith(folderTrack.filePath));
    expect(within(screen.getByRole("contentinfo")).getByText("Artist Folder Song")).toBeTruthy();
    expect(screen.getByRole("button", { name: "暂停" })).toBeTruthy();
  });

  it("does not skip an extra track when end-of-track signals fire together", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    });

    await waitFor(() => expect(window.musicApi.getPlayableUrl).toHaveBeenCalledWith(track.filePath));
    const audio = createdAudioElements[createdAudioElements.length - 1];
    Object.defineProperty(audio, "duration", {
      configurable: true,
      value: track.duration
    });

    await act(async () => {
      audio.currentTime = track.duration;
      audio.dispatchEvent(new Event("timeupdate"));
      audio.dispatchEvent(new Event("ended"));
    });

    await waitFor(() => expect(window.musicApi.getPlayableUrl).toHaveBeenLastCalledWith(folderTrack.filePath));
    expect(within(screen.getByRole("contentinfo")).getByText("Artist Folder Song")).toBeTruthy();
    expect(within(screen.getByRole("contentinfo")).queryByText("Second Song")).toBeNull();
  });

  it("ignores a saved playback track that is missing from the restored library", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    localStorage.setItem(
      playbackStateKey,
      JSON.stringify({
        trackId: "missing-track",
        currentTime: 42,
        queueTrackIds: [secondTrack.id],
        isPlayQueueExplicit: true,
        playlistLabel: "Missing"
      })
    );

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    expect(window.musicApi.getPlayableUrl).not.toHaveBeenCalled();
    expect(screen.queryByText("0:42")).toBeNull();
  });

  it("shows the song list without the large now-playing artwork on the main screen", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    expect(screen.queryByText("正在播放")).toBeNull();
  });

  it("remembers a newly chosen folder", async () => {
    window.musicApi.chooseMusicFolder = vi.fn(async () => scanResult);

    render(<App />);
    fireEvent.click(screen.getAllByText("选择文件夹")[0]);

    await waitFor(() => expect(localStorage.getItem("musicplayer:last-folder")).toBe(rememberedFolder));
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

  it("opens settings from the desktop lyrics menu command", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    await act(async () => {
      menuHandler?.("open-settings");
    });

    expect(screen.getByRole("region", { name: "设置" })).toBeTruthy();
  });

  it("uses the sidebar action area for library categories", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    expect(screen.queryByText("Rescan")).toBeNull();
    expect(screen.getByRole("button", { name: "歌曲" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "专辑" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "歌手" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "文件夹" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "专辑" }));
    expect(await screen.findByRole("heading", { name: "专辑" })).toBeTruthy();
    expect(screen.getByText("Wave Album")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "歌手" }));
    expect(await screen.findByRole("heading", { name: "歌手" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "音乐库浏览器" })).getByText("Second Artist")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "文件夹" }));
    expect(await screen.findByRole("heading", { name: "文件夹" })).toBeTruthy();
    const library = screen.getByRole("region", { name: "音乐库浏览器" });
    expect(within(library).getByRole("button", { name: /Second Artist.*3 首歌曲.*打开/ })).toBeTruthy();
    expect(within(library).queryByText("Second Artist/Second Album")).toBeNull();
  });

  it("drills into folders one level at a time and shows current-layer songs", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: "文件夹" }));
    let library = screen.getByRole("region", { name: "音乐库浏览器" });
    fireEvent.click(within(library).getByRole("button", { name: /Second Artist.*3 首歌曲.*打开/ }));

    expect(await screen.findByRole("heading", { name: "Second Artist" })).toBeTruthy();
    library = screen.getByRole("region", { name: "音乐库浏览器" });
    expect(within(library).getByRole("button", { name: /Second Album.*2 首歌曲.*打开/ })).toBeTruthy();
    expect(within(library).getByText("Artist Folder Song")).toBeTruthy();
    expect(within(library).queryByText("Second Song")).toBeNull();

    fireEvent.click(within(library).getByRole("button", { name: /Second Album.*2 首歌曲.*打开/ }));

    expect(await screen.findByRole("heading", { name: "Second Artist/Second Album" })).toBeTruthy();
    library = screen.getByRole("region", { name: "音乐库浏览器" });
    expect(within(library).queryByText("Wave Song")).toBeNull();
    expect(within(library).queryByText("Artist Folder Song")).toBeNull();
    expect(within(library).getByText("Second Song")).toBeTruthy();
    expect(within(library).getByText("Third Song")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "01 Second Song Second Artist Second Album 3:00" }));

    await waitFor(() => expect(window.musicApi.getPlayableUrl).toHaveBeenCalledWith(secondTrack.filePath));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

    const playlist = screen.getByRole("region", { name: "播放列表" });
    expect(within(playlist).getByText("Second Song")).toBeTruthy();
    expect(within(playlist).getByText("Third Song")).toBeTruthy();
    expect(within(playlist).queryByText("Wave Song")).toBeNull();
  });

  it("removes a track from the playlist without removing it from the library", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    const playlist = screen.getByRole("region", { name: "播放列表" });

    await act(async () => {
      fireEvent.click(within(playlist).getByRole("button", { name: "从播放列表移除 Wave Song" }));
    });

    expect(within(playlist).queryByText("Wave Song")).toBeNull();
    expect(within(screen.getByRole("region", { name: "音乐库浏览器" })).getByText("Wave Song")).toBeTruthy();
  });

  it("clears the playlist and keeps the library tracks visible", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    const playlist = screen.getByRole("region", { name: "播放列表" });

    await act(async () => {
      fireEvent.click(within(playlist).getByRole("button", { name: "清空播放列表" }));
    });

    expect(within(playlist).getByText("队列为空")).toBeTruthy();
    expect(within(playlist).queryByText("Wave Song")).toBeNull();
    expect(within(playlist).queryByText("Second Song")).toBeNull();
    expect(within(screen.getByRole("region", { name: "音乐库浏览器" })).getByText("Wave Song")).toBeTruthy();
  });

  it("opens the track context menu and disables lyric deletion when no lyrics exist", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    const trackButton = screen.getByRole("button", { name: "02 Artist Folder Song Second Artist Loose Songs 3:00" });
    expect(trackButton.className).not.toContain("active");

    fireEvent.contextMenu(trackButton, {
      clientX: 40,
      clientY: 80
    });

    expect(trackButton.className).toContain("context-menu-target");
    expect(screen.getByRole("menu")).toBeTruthy();
    expect((screen.getByRole("menuitem", { name: "删除当前歌词" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves edited metadata and updates visible track data", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.contextMenu(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "编辑音乐信息" }));
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "Edited Song" } });
    fireEvent.change(screen.getByLabelText("歌手"), { target: { value: "Edited Artist" } });
    fireEvent.change(screen.getByLabelText("专辑"), { target: { value: "Edited Album" } });
    fireEvent.change(screen.getByLabelText("曲号"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(window.musicApi.updateTrackMetadata).toHaveBeenCalledWith(track.filePath, {
        title: "Edited Song",
        artist: "Edited Artist",
        album: "Edited Album",
        trackNumber: 5
      })
    );
    expect(screen.getAllByText("Edited Song").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Edited Artist").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Edited Album").length).toBeGreaterThan(0);
  });

  it("trashes lyrics and clears lyric state for the track", async () => {
    const trackWithLyrics = { ...track, lyricsPath: "/music/Wave Song.lrc", hasLyrics: true };
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify({ ...scanResult, tracks: [trackWithLyrics, secondTrack] }));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.contextMenu(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "删除当前歌词" }));

    await waitFor(() => expect(window.musicApi.trashTrackLyrics).toHaveBeenCalledWith(trackWithLyrics));
    const cached = JSON.parse(localStorage.getItem(libraryCacheKey) ?? "{}") as ScanResult;
    expect(cached.tracks[0].lyricsPath).toBeNull();
    expect(cached.tracks[0].hasLyrics).toBe(false);
  });

  it("shows the disk filename in the track trash confirmation", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.contextMenu(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "移到废纸篓" }));

    expect(confirmSpy).toHaveBeenCalledWith("将把音乐文件“Wave Song.wav”以及同名歌词、同名封面移到废纸篓。是否继续？");
    expect(window.musicApi.trashTrackFiles).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("stops the current track before trashing it and does not start the next track", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const deleteEvents: string[] = [];
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(() => {
        deleteEvents.push("pause");
      })
    });
    window.musicApi.trashTrackFiles = vi.fn(async () => {
      deleteEvents.push("trash");
      return { ok: true, audioRemoved: true, trashed: [], failed: [], error: null };
    });

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    });
    await waitFor(() => expect(window.musicApi.getPlayableUrl).toHaveBeenCalledWith(track.filePath));

    fireEvent.contextMenu(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "移到废纸篓" }));

    await waitFor(() => expect(window.musicApi.trashTrackFiles).toHaveBeenCalledWith(track));
    expect(deleteEvents).toEqual(["pause", "trash"]);
    expect(window.musicApi.getPlayableUrl).not.toHaveBeenCalledWith(folderTrack.filePath);

    confirmSpy.mockRestore();
  });

  it("clears the current track if it is reselected while trashing", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    let resolveTrash!: (result: TrashTrackFilesResult) => void;
    const trashPromise = new Promise<TrashTrackFilesResult>((resolve) => {
      resolveTrash = resolve;
    });
    window.musicApi.trashTrackFiles = vi.fn(() => trashPromise);

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    });
    await waitFor(() => expect(window.musicApi.getPlayableUrl).toHaveBeenCalledWith(track.filePath));

    fireEvent.contextMenu(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "移到废纸篓" }));
    await waitFor(() => expect(window.musicApi.trashTrackFiles).toHaveBeenCalledWith(track));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    });
    expect(window.musicApi.getPlayableUrl).toHaveBeenLastCalledWith(track.filePath);
    expect(screen.getByRole("button", { name: "暂停" })).toBeTruthy();

    await act(async () => {
      resolveTrash({ ok: true, audioRemoved: true, trashed: [], failed: [], error: null });
      await trashPromise;
    });

    await waitFor(() =>
      expect(within(screen.getByRole("region", { name: "音乐库浏览器" })).queryByText("Wave Song")).toBeNull()
    );
    expect(within(screen.getByRole("region", { name: "播放列表" })).queryByText("Wave Song")).toBeNull();
    expect(within(screen.getByRole("contentinfo")).queryByText("Wave Song")).toBeNull();
    expect(screen.queryByRole("button", { name: "暂停" })).toBeNull();
    expect(window.musicApi.getPlayableUrl).not.toHaveBeenCalledWith(folderTrack.filePath);

    confirmSpy.mockRestore();
  });

  it("trashes a track and removes it from library and playlist", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.contextMenu(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "移到废纸篓" }));

    await waitFor(() => expect(window.musicApi.trashTrackFiles).toHaveBeenCalledWith(track));
    expect(within(screen.getByRole("region", { name: "音乐库浏览器" })).queryByText("Wave Song")).toBeNull();
    expect(within(screen.getByRole("region", { name: "播放列表" })).queryByText("Wave Song")).toBeNull();

    confirmSpy.mockRestore();
  });

  it("queues only the selected artist when playing an artist group", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "歌手" }));

    const library = screen.getByRole("region", { name: "音乐库浏览器" });
    await act(async () => {
      fireEvent.click(within(library).getByRole("button", { name: /Second Artist.*3 首歌曲.*播放/ }));
    });

    const playlist = screen.getByRole("region", { name: "播放列表" });
    expect(within(playlist).getByText("Artist Folder Song")).toBeTruthy();
    expect(within(playlist).getByText("Second Song")).toBeTruthy();
    expect(within(playlist).getByText("Third Song")).toBeTruthy();
    expect(within(playlist).queryByText("Wave Song")).toBeNull();
  });

  it("opens settings from the sidebar and returns to the library from a category", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "设置" }));

    expect(screen.getByRole("region", { name: "设置" })).toBeTruthy();
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "设置" }).className).toContain("active");
    expect(screen.getByRole("button", { name: "歌曲" }).className).not.toContain("active");

    fireEvent.click(screen.getByRole("button", { name: "专辑" }));

    expect(await screen.findByRole("heading", { name: "专辑" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "设置" })).toBeNull();
  });

  it("shows the selected folder path only on the settings page", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    expect(screen.queryByText(rememberedFolder)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "设置" }));

    expect(screen.getByText(rememberedFolder)).toBeTruthy();
  });

  it("clears only the library cache from settings", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    localStorage.setItem(
      playbackStateKey,
      JSON.stringify({
        trackId: track.id,
        currentTime: 12,
        queueTrackIds: [track.id],
        isPlayQueueExplicit: true,
        playlistLabel: "Library"
      })
    );

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.click(screen.getByRole("button", { name: "清除音乐库缓存" }));

    expect(localStorage.getItem(libraryCacheKey)).toBeNull();
    expect(localStorage.getItem("musicplayer:last-folder")).toBe(rememberedFolder);
    expect(localStorage.getItem(playbackStateKey)).not.toBeNull();
    expect(screen.getByText("音乐库缓存已清除。")).toBeTruthy();
  });

  it("loads system fonts for lyric font controls", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

    render(<App />);

    await waitFor(() => expect(window.musicApi.listSystemFonts).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "设置" }));

    expect(screen.getAllByRole("option", { name: "PingFang SC" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("option", { name: "LXGW WenKai" }).length).toBeGreaterThan(0);
  });

  it("persists fullscreen lyrics font family and applies it to fullscreen lyrics", async () => {
    const trackWithLyrics = { ...track, lyricsPath: "/music/Wave Song.lrc", hasLyrics: true };
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify({ ...scanResult, tracks: [trackWithLyrics] }));
    window.musicApi.getLyrics = vi.fn(async () => "[00:00.00]Preview lyric");

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.change(screen.getByLabelText("全屏歌词字体"), { target: { value: "PingFang SC" } });
    fireEvent.change(screen.getByLabelText("全屏歌词字号"), { target: { value: "48" } });

    expect(JSON.parse(localStorage.getItem(appSettingsKey) ?? "{}")).toMatchObject({
      fullscreenLyricsFontFamily: "PingFang SC",
      fullscreenLyricsFontSize: 48
    });

    fireEvent.click(screen.getByRole("button", { name: "歌曲" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "打开全屏歌词" }));

    expect(await screen.findByText("Preview lyric")).toBeTruthy();
    const fullscreenLyrics = screen.getByRole("region", { name: "全屏歌词" });
    expect((fullscreenLyrics as HTMLElement).style.getPropertyValue("--fullscreen-lyrics-font-family")).toContain("PingFang SC");
    expect((fullscreenLyrics as HTMLElement).style.getPropertyValue("--fullscreen-lyrics-font-size")).toBe("48px");
  });

  it("opens and updates desktop lyrics when enabled", async () => {
    const trackWithLyrics = { ...track, lyricsPath: "/music/Wave Song.lrc", hasLyrics: true };
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify({ ...scanResult, tracks: [trackWithLyrics] }));
    window.musicApi.getLyrics = vi.fn(async () => "[00:00.00]Desktop current\n[00:10.00]Desktop next");

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.change(screen.getByLabelText("桌面歌词字体"), { target: { value: "LXGW WenKai" } });
    fireEvent.change(screen.getByLabelText("桌面歌词字号"), { target: { value: "32" } });
    fireEvent.click(screen.getByLabelText("显示桌面歌词"));

    expect(window.musicApi.showDesktopLyrics).toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(appSettingsKey) ?? "{}")).toMatchObject({
      desktopLyricsEnabled: true,
      desktopLyricsFontFamily: "LXGW WenKai",
      desktopLyricsFontSize: 32
    });

    fireEvent.click(screen.getByRole("button", { name: "歌曲" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    });

    await waitFor(() =>
      expect(window.musicApi.updateDesktopLyrics).toHaveBeenLastCalledWith(
        expect.objectContaining({
          trackTitle: "Wave Song",
          artist: "Artist",
          currentLine: "Desktop current",
          nextLine: "Desktop next",
          fontFamily: "LXGW WenKai",
          fontSize: 32
        })
      )
    );
  });

  it("disables persisted desktop lyrics when the desktop window closes", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    localStorage.setItem(appSettingsKey, JSON.stringify({ ...defaultStoredSettings(), desktopLyricsEnabled: true }));

    render(<App />);

    await waitFor(() => expect(window.musicApi.showDesktopLyrics).toHaveBeenCalled());
    act(() => {
      desktopLyricsClosedHandler?.();
    });

    expect(JSON.parse(localStorage.getItem(appSettingsKey) ?? "{}")).toMatchObject({ desktopLyricsEnabled: false });
  });

  it("persists and applies the system media shortcut setting", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    localStorage.setItem(appSettingsKey, JSON.stringify({ ...defaultStoredSettings(), systemMediaShortcutsEnabled: true }));

    render(<App />);

    await waitFor(() => expect(window.musicApi.setSystemMediaShortcutsEnabled).toHaveBeenCalledWith(true));
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.click(screen.getByLabelText("系统媒体快捷键"));

    await waitFor(() => expect(window.musicApi.setSystemMediaShortcutsEnabled).toHaveBeenLastCalledWith(false));
    expect(JSON.parse(localStorage.getItem(appSettingsKey) ?? "{}")).toMatchObject({
      systemMediaShortcutsEnabled: false
    });
  });

  it("persists and applies the close-window playback setting", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    localStorage.setItem(appSettingsKey, JSON.stringify({ ...defaultStoredSettings(), closeWindowStopsPlayback: true }));

    render(<App />);

    await waitFor(() => expect(window.musicApi.setCloseWindowStopsPlayback).toHaveBeenCalledWith(true));
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.click(screen.getByLabelText("关闭窗口时停止播放"));

    await waitFor(() => expect(window.musicApi.setCloseWindowStopsPlayback).toHaveBeenLastCalledWith(false));
    expect(JSON.parse(localStorage.getItem(appSettingsKey) ?? "{}")).toMatchObject({
      closeWindowStopsPlayback: false
    });
  });

  it("shows which system media shortcuts failed to register", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    localStorage.setItem(appSettingsKey, JSON.stringify({ ...defaultStoredSettings(), systemMediaShortcutsEnabled: true }));
    window.musicApi.setSystemMediaShortcutsEnabled = vi.fn(async () => ({
      ok: false as const,
      failedCommands: ["play-pause" as const, "next" as const]
    }));

    render(<App />);

    expect(await screen.findByText("无法启用系统媒体快捷键：播放/暂停、下一首注册失败。")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(appSettingsKey) ?? "{}")).toMatchObject({
      systemMediaShortcutsEnabled: false
    });
  });

  it("checks accessibility permission only when enabling system media shortcuts", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    window.musicApi.ensureSystemMediaShortcutsPermission = vi.fn(async () => ({
      ok: false as const,
      reason: "accessibility-permission-denied" as const
    }));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    expect(window.musicApi.ensureSystemMediaShortcutsPermission).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.click(screen.getByLabelText("系统媒体快捷键"));

    await waitFor(() => expect(window.musicApi.ensureSystemMediaShortcutsPermission).toHaveBeenCalledTimes(1));
    expect(window.musicApi.setSystemMediaShortcutsEnabled).not.toHaveBeenCalledWith(true);
    expect(JSON.parse(localStorage.getItem(appSettingsKey) ?? "{}")).not.toMatchObject({
      systemMediaShortcutsEnabled: true
    });
    expect((screen.getByLabelText("系统媒体快捷键") as HTMLInputElement).checked).toBe(false);
  });

  it("handles system media key commands through the audio player", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));

    await act(async () => {
      mediaKeyHandler?.("play-pause");
    });
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
    expect(window.musicApi.getPlayableUrl).toHaveBeenCalledWith(track.filePath);

    await act(async () => {
      mediaKeyHandler?.("next");
    });
    await waitFor(() => expect(window.musicApi.getPlayableUrl).toHaveBeenCalledWith(folderTrack.filePath));

    await act(async () => {
      mediaKeyHandler?.("previous");
    });
    await waitFor(() => expect(window.musicApi.getPlayableUrl).toHaveBeenCalledWith(track.filePath));
  });

  it("restores saved volume into the player", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    localStorage.setItem(appSettingsKey, JSON.stringify({ ...defaultStoredSettings(), volume: 0.35 }));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    expect((screen.getByLabelText("音量") as HTMLInputElement).value).toBe("0.35");
    expect(createdAudioElements[0].volume).toBe(0.35);
  });

  it("persists volume changes", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText("音量"), { target: { value: "0.44" } });

    expect(JSON.parse(localStorage.getItem(appSettingsKey) ?? "{}")).toMatchObject({ volume: 0.44 });
    expect(createdAudioElements[0].volume).toBe(0.44);
  });

  it("restores saved playback mode", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    localStorage.setItem(appSettingsKey, JSON.stringify({ ...defaultStoredSettings(), shuffle: true, repeat: "off" }));

    render(<App />);

    await waitFor(() => expect(screen.getByRole("button", { name: "播放模式：随机播放" })).toBeTruthy());
  });

  it("persists playback mode changes", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "播放模式：关闭" }));

    expect(JSON.parse(localStorage.getItem(appSettingsKey) ?? "{}")).toMatchObject({ shuffle: true, repeat: "off" });

    fireEvent.click(screen.getByRole("button", { name: "播放模式：随机播放" }));

    expect(JSON.parse(localStorage.getItem(appSettingsKey) ?? "{}")).toMatchObject({ shuffle: false, repeat: "all" });
  });

  it("persists fullscreen lyrics font size and applies it to fullscreen lyrics", async () => {
    const trackWithLyrics = { ...track, lyricsPath: "/music/Wave Song.lrc", hasLyrics: true };
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify({ ...scanResult, tracks: [trackWithLyrics] }));
    window.musicApi.getLyrics = vi.fn(async () => "[00:00.00]Preview lyric");

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.change(screen.getByLabelText("全屏歌词字号"), { target: { value: "48" } });

    expect(JSON.parse(localStorage.getItem(appSettingsKey) ?? "{}")).toEqual({
      fullscreenLyricsFontFamily: "",
      fullscreenLyricsFontSize: 48,
      systemMediaShortcutsEnabled: false,
      closeWindowStopsPlayback: false,
      desktopLyricsEnabled: false,
      desktopLyricsFontFamily: "",
      desktopLyricsFontSize: 28,
      volume: 0.82,
      shuffle: false,
      repeat: "off"
    });

    fireEvent.click(screen.getByRole("button", { name: "歌曲" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "打开全屏歌词" }));

    expect(await screen.findByText("Preview lyric")).toBeTruthy();
    const fullscreenLyrics = screen.getByRole("region", { name: "全屏歌词" });
    expect((fullscreenLyrics as HTMLElement).style.getPropertyValue("--fullscreen-lyrics-font-size")).toBe("48px");
  });

  it("falls back to the default fullscreen lyrics font size when saved settings are invalid", async () => {
    localStorage.setItem(appSettingsKey, JSON.stringify({ fullscreenLyricsFontSize: 72 }));

    render(<App />);
    await waitFor(() => expect(window.musicApi.listSystemFonts).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "设置" }));

    expect((screen.getByLabelText("全屏歌词字号") as HTMLInputElement).value).toBe("36");
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

function playbackStateWriteCount(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.filter(([key]) => key === playbackStateKey).length;
}

function defaultStoredSettings() {
  return {
    fullscreenLyricsFontFamily: "",
    fullscreenLyricsFontSize: 36,
    systemMediaShortcutsEnabled: false,
    closeWindowStopsPlayback: false,
    desktopLyricsEnabled: false,
    desktopLyricsFontFamily: "",
    desktopLyricsFontSize: 28,
    volume: 0.82,
    shuffle: false,
    repeat: "off"
  };
}
