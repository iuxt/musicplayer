import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScanProgress, ScanResult, ScanWarning, Track } from "../shared/types";
import { EmptyState } from "./components/EmptyState";
import { FullscreenLyrics } from "./components/FullscreenLyrics";
import { LibraryList } from "./components/LibraryList";
import { PlayerBar } from "./components/PlayerBar";
import { Playlist } from "./components/Playlist";
import { ScanningState } from "./components/ScanningState";
import { Sidebar } from "./components/Sidebar";
import { getParentFolderPath, getTracksAtFolderLevel } from "./folderBrowser";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import type { LibraryCategory } from "./libraryCategories";

const LAST_FOLDER_STORAGE_KEY = "local-music-player:last-folder";
const LIBRARY_CACHE_STORAGE_KEY = "local-music-player:library-cache";

export function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [warnings, setWarnings] = useState<ScanWarning[]>([]);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>("songs");
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [playQueue, setPlayQueue] = useState<Track[]>([]);
  const [isPlayQueueExplicit, setIsPlayQueueExplicit] = useState(false);
  const [playlistLabel, setPlaylistLabel] = useState("Library");
  const [appError, setAppError] = useState<string | null>(null);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [isLyricsLoading, setIsLyricsLoading] = useState(false);
  const [isFullscreenLyricsOpen, setIsFullscreenLyricsOpen] = useState(false);

  const loadLibraryResult = useCallback((result: ScanResult) => {
    setFolderPath(result.folderPath);
    setTracks(result.tracks);
    setWarnings(result.warnings);
    setPlayQueue(result.tracks);
    setIsPlayQueueExplicit(false);
    setPlaylistLabel("Library");
    setSelectedFolderPath(null);
    localStorage.setItem(LAST_FOLDER_STORAGE_KEY, result.folderPath);
  }, []);

  const filteredTracks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return tracks;
    }

    return tracks.filter((track) =>
      [track.title, track.artist, track.album].some((value) => value.toLowerCase().includes(query))
    );
  }, [search, tracks]);

  const visibleTracks = useMemo(() => {
    return filteredTracks;
  }, [filteredTracks]);

  const playlistTracks = useMemo(() => {
    if (isPlayQueueExplicit) {
      return playQueue;
    }

    return playQueue.length > 0 ? playQueue : filteredTracks;
  }, [filteredTracks, isPlayQueueExplicit, playQueue]);

  const player = useAudioPlayer(playlistTracks);

  useEffect(() => {
    if (!isPlayQueueExplicit) {
      setPlayQueue((currentQueue) => (currentQueue.length > 0 ? currentQueue : tracks));
    }
  }, [isPlayQueueExplicit, tracks]);

  const chooseFolder = useCallback(async () => {
    setIsScanning(true);
    setAppError(null);
    setScanProgress(null);

    try {
      const result = await window.musicApi.chooseMusicFolder();
      if (!result) {
        return;
      }
      loadLibraryResult(result);
      saveLibraryCache(result);
    } catch (error) {
      setAppError(error instanceof Error ? error.message : "Unable to scan the folder.");
    } finally {
      setIsScanning(false);
    }
  }, [loadLibraryResult]);

  const rescan = useCallback(async () => {
    if (!folderPath) {
      return;
    }

    setIsScanning(true);
    setAppError(null);
    setScanProgress(null);

    try {
      const result = await window.musicApi.rescanLibrary(folderPath);
      loadLibraryResult(result);
      saveLibraryCache(result);
    } catch (error) {
      setAppError(error instanceof Error ? error.message : "Unable to rescan the folder.");
    } finally {
      setIsScanning(false);
    }
  }, [folderPath, loadLibraryResult]);

  useEffect(() => {
    return window.musicApi.onScanProgress(setScanProgress);
  }, []);

  useEffect(() => {
    return window.musicApi.onMenuCommand((command) => {
      if (command === "choose-folder") {
        void chooseFolder();
      }
      if (command === "rescan-library") {
        void rescan();
      }
    });
  }, [chooseFolder, rescan]);

  useEffect(() => {
    const rememberedFolderPath = localStorage.getItem(LAST_FOLDER_STORAGE_KEY);
    if (!rememberedFolderPath) {
      return;
    }

    let cancelled = false;
    const cachedResult = readLibraryCache(rememberedFolderPath);
    if (cachedResult) {
      loadLibraryResult(cachedResult);
      return;
    }

    setFolderPath(rememberedFolderPath);
    setIsScanning(true);
    setAppError(null);
    setScanProgress(null);

    void window.musicApi
      .rescanLibrary(rememberedFolderPath)
      .then((result) => {
        if (cancelled) {
          return;
        }
        loadLibraryResult(result);
        saveLibraryCache(result);
      })
      .catch((error) => {
        if (!cancelled) {
          setAppError(error instanceof Error ? error.message : "Unable to reopen the last music folder.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsScanning(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadLibraryResult]);

  useEffect(() => {
    let cancelled = false;
    const track = player.currentTrack;
    setArtworkUrl(null);
    setLyrics(null);
    setIsLyricsLoading(Boolean(track?.hasLyrics));

    if (!track) {
      setIsLyricsLoading(false);
      return;
    }

    void window.musicApi.getArtworkUrl(track.artworkPath).then((url) => {
      if (!cancelled) {
        setArtworkUrl(url);
      }
    });

    void window.musicApi
      .getLyrics(track.lyricsPath)
      .then((text) => {
        if (!cancelled) {
          setLyrics(text);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLyrics(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLyricsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [player.currentTrack]);

  function changeCategory(category: LibraryCategory) {
    setActiveCategory(category);
    if (category !== "folders") {
      setSelectedFolderPath(null);
    }
  }

  function openFolder(nextFolderPath: string) {
    setSelectedFolderPath(nextFolderPath);
  }

  function backFolder() {
    setSelectedFolderPath(getParentFolderPath(selectedFolderPath));
  }

  async function playTrack(track: Track, queueTracks?: Track[]) {
    const nextQueue = queueTracks ?? (activeCategory === "folders" ? getTracksAtFolderLevel(filteredTracks, selectedFolderPath) : filteredTracks);
    setPlayQueue(nextQueue);
    setIsPlayQueueExplicit(true);
    setPlaylistLabel(activeCategory === "folders" ? selectedFolderPath ?? "Folders" : "Library");
    await player.playTrack(track);
  }

  async function selectPlaylistTrack(track: Track) {
    await player.playTrack(track);
  }

  async function selectTrack(track: Track) {
    await player.selectTrack(track);
  }

  function clearPlaylist() {
    setPlayQueue([]);
    setIsPlayQueueExplicit(true);
  }

  function removePlaylistTrack(track: Track) {
    setPlayQueue(playlistTracks.filter((queuedTrack) => queuedTrack.id !== track.id));
    setIsPlayQueueExplicit(true);
  }

  return (
    <div className="app-frame">
      <Sidebar
        folderPath={folderPath}
        trackCount={tracks.length}
        activeCategory={activeCategory}
        onCategoryChange={changeCategory}
      />

      <main className="main-stage">
        {isScanning ? <ScanningState progress={scanProgress} /> : null}
        {appError ? <div className="app-error">{appError}</div> : null}
        {warnings.length > 0 ? <div className="warning-strip">{warnings.length} files skipped while scanning.</div> : null}

        {tracks.length === 0 ? (
          <EmptyState onChooseFolder={chooseFolder} isScanning={isScanning} />
        ) : (
          <div className="library-workspace">
            <LibraryList
              category={activeCategory}
              tracks={visibleTracks}
              currentTrack={player.currentTrack}
              search={search}
              selectedFolderPath={selectedFolderPath}
              onSearchChange={setSearch}
              onSelectTrack={playTrack}
              onOpenFolder={openFolder}
              onBackToFolders={backFolder}
            />
            <Playlist
              tracks={playlistTracks}
              currentTrack={player.currentTrack}
              label={playlistLabel}
              onSelectTrack={selectPlaylistTrack}
              onClear={clearPlaylist}
              onRemoveTrack={removePlaylistTrack}
            />
          </div>
        )}
      </main>

      {isFullscreenLyricsOpen ? (
        <FullscreenLyrics
          track={player.currentTrack}
          artworkUrl={artworkUrl}
          lyrics={lyrics}
          isLyricsLoading={isLyricsLoading}
          currentTime={player.currentTime}
          onClose={() => setIsFullscreenLyricsOpen(false)}
        />
      ) : null}

      <PlayerBar
        track={player.currentTrack}
        artworkUrl={artworkUrl}
        isPlaying={player.isPlaying}
        currentTime={player.currentTime}
        duration={player.duration}
        volume={player.volume}
        shuffle={player.shuffle}
        repeat={player.repeat}
        onOpenNowPlaying={() => setIsFullscreenLyricsOpen(true)}
        onPlayPause={() => {
          void player.playPause();
        }}
        onPrevious={() => {
          void player.previous();
        }}
        onNext={() => {
          void player.next();
        }}
        onSeek={player.seek}
        onVolume={player.setVolume}
        onPlaybackMode={player.cyclePlaybackMode}
      />
    </div>
  );
}

function saveLibraryCache(result: ScanResult) {
  localStorage.setItem(LIBRARY_CACHE_STORAGE_KEY, JSON.stringify(result));
}

function readLibraryCache(folderPath: string): ScanResult | null {
  const cachedValue = localStorage.getItem(LIBRARY_CACHE_STORAGE_KEY);
  if (!cachedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(cachedValue) as unknown;
    return isScanResultForFolder(parsed, folderPath) ? parsed : null;
  } catch {
    return null;
  }
}

function isScanResultForFolder(value: unknown, folderPath: string): value is ScanResult {
  if (!isRecord(value)) {
    return false;
  }

  return value.folderPath === folderPath && Array.isArray(value.tracks) && value.tracks.every(isTrack) && Array.isArray(value.warnings);
}

function isTrack(value: unknown): value is Track {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.filePath === "string" &&
    typeof value.title === "string" &&
    typeof value.artist === "string" &&
    typeof value.album === "string" &&
    typeof value.duration === "number" &&
    (typeof value.trackNumber === "number" || value.trackNumber === null) &&
    typeof value.extension === "string" &&
    (typeof value.artworkId === "string" || value.artworkId === null) &&
    (typeof value.artworkPath === "string" || value.artworkPath === null) &&
    (typeof value.lyricsPath === "string" || value.lyricsPath === null) &&
    typeof value.hasLyrics === "boolean" &&
    typeof value.folderPath === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
