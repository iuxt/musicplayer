import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScanProgress, ScanResult, ScanWarning, Track, TrackMetadataUpdate } from "../shared/types";
import { EditTrackMetadataDialog } from "./components/EditTrackMetadataDialog";
import { EmptyState } from "./components/EmptyState";
import { FullscreenLyrics } from "./components/FullscreenLyrics";
import { LibraryList } from "./components/LibraryList";
import { PlayerBar } from "./components/PlayerBar";
import { Playlist } from "./components/Playlist";
import { ScanningState } from "./components/ScanningState";
import { Sidebar } from "./components/Sidebar";
import { TrackContextMenu } from "./components/TrackContextMenu";
import { getParentFolderPath, getTracksAtFolderLevel } from "./folderBrowser";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import type { LibraryCategory } from "./libraryCategories";

const LAST_FOLDER_STORAGE_KEY = "local-music-player:last-folder";
const LIBRARY_CACHE_STORAGE_KEY = "local-music-player:library-cache";
const PLAYBACK_STATE_STORAGE_KEY = "local-music-player:playback-state";
const PLAYBACK_PROGRESS_SAVE_INTERVAL_MS = 5000;

type PlaybackState = {
  trackId: string;
  currentTime: number;
  queueTrackIds: string[];
  isPlayQueueExplicit: boolean;
  playlistLabel: string;
};

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
  const [pendingPlaybackRestore, setPendingPlaybackRestore] = useState<PlaybackState | null>(null);
  const [trackMenu, setTrackMenu] = useState<{ track: Track; position: { x: number; y: number } } | null>(null);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [pendingMediaAction, setPendingMediaAction] = useState(false);
  const lastPlaybackSaveRef = useRef<{
    trackId: string | null;
    queueKey: string;
    isPlayQueueExplicit: boolean;
    playlistLabel: string;
    savedAt: number;
    wasPlaying: boolean;
  }>({
    trackId: null,
    queueKey: "",
    isPlayQueueExplicit: false,
    playlistLabel: "",
    savedAt: 0,
    wasPlaying: false
  });

  const loadLibraryResult = useCallback((result: ScanResult) => {
    setFolderPath(result.folderPath);
    setTracks(result.tracks);
    setWarnings(result.warnings);
    setPlayQueue(result.tracks);
    setIsPlayQueueExplicit(false);
    setPlaylistLabel("Library");
    setSelectedFolderPath(null);
    localStorage.setItem(LAST_FOLDER_STORAGE_KEY, result.folderPath);

    const playbackState = readPlaybackState(result.tracks);
    if (!playbackState) {
      setPendingPlaybackRestore(null);
      return;
    }

    const tracksById = new Map(result.tracks.map((track) => [track.id, track]));
    const restoredQueue = playbackState.queueTrackIds
      .map((trackId) => tracksById.get(trackId))
      .filter((track): track is Track => Boolean(track));

    setPlayQueue(restoredQueue.length > 0 ? restoredQueue : result.tracks);
    setIsPlayQueueExplicit(playbackState.isPlayQueueExplicit && restoredQueue.length > 0);
    setPlaylistLabel(playbackState.playlistLabel || "Library");
    setPendingPlaybackRestore(playbackState);
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
  const playlistTrackIds = useMemo(() => playlistTracks.map((track) => track.id), [playlistTracks]);
  const playlistQueueKey = useMemo(() => playlistTrackIds.join("\u0000"), [playlistTrackIds]);

  const player = useAudioPlayer(playlistTracks);

  useEffect(() => {
    if (!pendingPlaybackRestore) {
      return;
    }

    const track = playlistTracks.find((queuedTrack) => queuedTrack.id === pendingPlaybackRestore.trackId) ?? null;
    if (!track) {
      setPendingPlaybackRestore(null);
      return;
    }

    setPendingPlaybackRestore(null);
    void player.restoreTrack(track, clampPlaybackTime(pendingPlaybackRestore.currentTime, track.duration));
  }, [pendingPlaybackRestore, player.restoreTrack, playlistTracks]);

  useEffect(() => {
    if (!player.currentTrack) {
      return;
    }

    const now = Date.now();
    const lastSave = lastPlaybackSaveRef.current;
    const shouldSave =
      lastSave.trackId !== player.currentTrack.id ||
      lastSave.queueKey !== playlistQueueKey ||
      lastSave.isPlayQueueExplicit !== isPlayQueueExplicit ||
      lastSave.playlistLabel !== playlistLabel ||
      (lastSave.wasPlaying && !player.isPlaying) ||
      now - lastSave.savedAt >= PLAYBACK_PROGRESS_SAVE_INTERVAL_MS;

    if (!shouldSave) {
      return;
    }

    savePlaybackState({
      trackId: player.currentTrack.id,
      currentTime: clampPlaybackTime(player.currentTime, player.currentTrack.duration),
      queueTrackIds: playlistTrackIds,
      isPlayQueueExplicit,
      playlistLabel
    });

    lastPlaybackSaveRef.current = {
      trackId: player.currentTrack.id,
      queueKey: playlistQueueKey,
      isPlayQueueExplicit,
      playlistLabel,
      savedAt: now,
      wasPlaying: player.isPlaying
    };
  }, [
    isPlayQueueExplicit,
    player.currentTime,
    player.currentTrack,
    player.isPlaying,
    playlistLabel,
    playlistQueueKey,
    playlistTrackIds
  ]);

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

  const changeCategory = useCallback((category: LibraryCategory) => {
    setActiveCategory(category);
    if (category !== "folders") {
      setSelectedFolderPath(null);
    }
  }, []);

  const openFolder = useCallback((nextFolderPath: string) => {
    setSelectedFolderPath(nextFolderPath);
  }, []);

  const backFolder = useCallback(() => {
    setSelectedFolderPath(getParentFolderPath(selectedFolderPath));
  }, [selectedFolderPath]);

  const playTrack = useCallback(
    async (track: Track, queueTracks?: Track[]) => {
      const nextQueue =
        queueTracks ?? (activeCategory === "folders" ? getTracksAtFolderLevel(filteredTracks, selectedFolderPath) : filteredTracks);
      setPlayQueue(nextQueue);
      setIsPlayQueueExplicit(true);
      setPlaylistLabel(activeCategory === "folders" ? selectedFolderPath ?? "Folders" : "Library");
      await player.playTrack(track);
    },
    [activeCategory, filteredTracks, player.playTrack, selectedFolderPath]
  );

  const selectPlaylistTrack = useCallback(async (track: Track) => {
    await player.playTrack(track);
  }, [player.playTrack]);

  const selectTrack = useCallback(async (track: Track) => {
    await player.selectTrack(track);
  }, [player.selectTrack]);

  const clearPlaylist = useCallback(() => {
    setPlayQueue([]);
    setIsPlayQueueExplicit(true);
  }, []);

  const removePlaylistTrack = useCallback((track: Track) => {
    setPlayQueue(playlistTracks.filter((queuedTrack) => queuedTrack.id !== track.id));
    setIsPlayQueueExplicit(true);
  }, [playlistTracks]);

  const commitTracks = useCallback(
    (updater: (currentTracks: Track[]) => Track[]) => {
      setTracks((currentTracks) => {
        const nextTracks = updater(currentTracks);
        if (folderPath) {
          saveLibraryCache({ folderPath, tracks: nextTracks, warnings });
        }
        return nextTracks;
      });
    },
    [folderPath, warnings]
  );

  const replaceTrack = useCallback(
    (updatedTrack: Track) => {
      commitTracks((currentTracks) =>
        sortTracksByTitle(currentTracks.map((existingTrack) => (existingTrack.id === updatedTrack.id ? updatedTrack : existingTrack)))
      );
      setPlayQueue((queue) => queue.map((queuedTrack) => (queuedTrack.id === updatedTrack.id ? updatedTrack : queuedTrack)));
      player.replaceCurrentTrack(updatedTrack);
    },
    [commitTracks, player]
  );

  const updateTrackLyricsState = useCallback(
    (trackId: string) => {
      commitTracks((currentTracks) =>
        currentTracks.map((existingTrack) =>
          existingTrack.id === trackId ? { ...existingTrack, lyricsPath: null, hasLyrics: false } : existingTrack
        )
      );
      setPlayQueue((queue) =>
        queue.map((queuedTrack) => (queuedTrack.id === trackId ? { ...queuedTrack, lyricsPath: null, hasLyrics: false } : queuedTrack))
      );
      if (player.currentTrack?.id === trackId) {
        setLyrics(null);
        setIsLyricsLoading(false);
        player.replaceCurrentTrack({ ...player.currentTrack, lyricsPath: null, hasLyrics: false });
      }
    },
    [commitTracks, player]
  );

  const removeTrackFromLibrary = useCallback(
    async (trackToRemove: Track) => {
      const currentQueueIndex = playlistTracks.findIndex((queuedTrack) => queuedTrack.id === trackToRemove.id);
      const nextQueue = playlistTracks.filter((queuedTrack) => queuedTrack.id !== trackToRemove.id);
      const nextTrack = currentQueueIndex >= 0 ? nextQueue[currentQueueIndex] ?? null : null;

      commitTracks((currentTracks) => currentTracks.filter((existingTrack) => existingTrack.id !== trackToRemove.id));
      setPlayQueue(nextQueue);
      setIsPlayQueueExplicit(true);
      removePlaybackStateForTrack(trackToRemove.id);

      if (player.currentTrack?.id !== trackToRemove.id) {
        return;
      }

      setLyrics(null);
      setArtworkUrl(null);
      setIsLyricsLoading(false);
      if (!nextTrack) {
        player.stop();
        return;
      }

      if (player.isPlaying) {
        await player.playTrack(nextTrack);
      } else {
        await player.selectTrack(nextTrack);
      }
    },
    [commitTracks, player, playlistTracks]
  );

  const showTrackInFolder = useCallback(async (track: Track) => {
    setPendingMediaAction(true);
    setAppError(null);
    try {
      const result = await window.musicApi.showTrackInFolder(track.filePath);
      if (!result.ok) {
        setAppError(result.error);
      }
    } catch (error) {
      setAppError(error instanceof Error ? error.message : "Unable to open the file location.");
    } finally {
      setPendingMediaAction(false);
      setTrackMenu(null);
    }
  }, []);

  const saveTrackMetadata = useCallback(
    async (metadata: TrackMetadataUpdate) => {
      if (!editingTrack) {
        return;
      }

      setPendingMediaAction(true);
      setMetadataError(null);
      try {
        const result = await window.musicApi.updateTrackMetadata(editingTrack.filePath, metadata);
        if (!result.ok) {
          setMetadataError(result.error);
          return;
        }

        replaceTrack({
          ...editingTrack,
          title: result.metadata.title,
          artist: result.metadata.artist,
          album: result.metadata.album,
          trackNumber: result.metadata.trackNumber,
          duration: result.metadata.duration || editingTrack.duration
        });
        setEditingTrack(null);
      } catch (error) {
        setMetadataError(error instanceof Error ? error.message : "Unable to update music information.");
      } finally {
        setPendingMediaAction(false);
      }
    },
    [editingTrack, replaceTrack]
  );

  const deleteTrackLyrics = useCallback(
    async (track: Track) => {
      setPendingMediaAction(true);
      setAppError(null);
      try {
        const result = await window.musicApi.trashTrackLyrics(track);
        if (!result.ok) {
          setAppError(result.error);
          return;
        }
        updateTrackLyricsState(track.id);
      } catch (error) {
        setAppError(error instanceof Error ? error.message : "Unable to move lyrics to trash.");
      } finally {
        setPendingMediaAction(false);
        setTrackMenu(null);
      }
    },
    [updateTrackLyricsState]
  );

  const deleteTrackFiles = useCallback(
    async (track: Track) => {
      const confirmed = window.confirm("将把当前音乐文件、同名歌词和同名封面移到废纸篓。是否继续？");
      if (!confirmed) {
        setTrackMenu(null);
        return;
      }

      setPendingMediaAction(true);
      setAppError(null);
      try {
        const result = await window.musicApi.trashTrackFiles(track);
        if (result.audioRemoved) {
          await removeTrackFromLibrary(track);
        }
        if (!result.ok && result.error) {
          setAppError(result.error);
        }
      } catch (error) {
        setAppError(error instanceof Error ? error.message : "Unable to move the music file to trash.");
      } finally {
        setPendingMediaAction(false);
        setTrackMenu(null);
      }
    },
    [removeTrackFromLibrary]
  );

  return (
    <div className="app-frame">
      <div className="window-drag-region" aria-hidden="true" />
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
              onTrackContextMenu={(track, position) => setTrackMenu({ track, position })}
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

      {trackMenu ? (
        <TrackContextMenu
          track={trackMenu.track}
          position={trackMenu.position}
          busy={pendingMediaAction}
          onClose={() => setTrackMenu(null)}
          onShowInFolder={() => {
            void showTrackInFolder(trackMenu.track);
          }}
          onEdit={() => {
            setMetadataError(null);
            setEditingTrack(trackMenu.track);
            setTrackMenu(null);
          }}
          onDeleteLyrics={() => {
            void deleteTrackLyrics(trackMenu.track);
          }}
          onDeleteTrack={() => {
            void deleteTrackFiles(trackMenu.track);
          }}
        />
      ) : null}

      {editingTrack ? (
        <EditTrackMetadataDialog
          track={editingTrack}
          busy={pendingMediaAction}
          error={metadataError}
          onCancel={() => setEditingTrack(null)}
          onSave={(metadata) => {
            void saveTrackMetadata(metadata);
          }}
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

function savePlaybackState(state: PlaybackState) {
  localStorage.setItem(PLAYBACK_STATE_STORAGE_KEY, JSON.stringify(state));
}

function readPlaybackState(tracks: Track[]): PlaybackState | null {
  const cachedValue = localStorage.getItem(PLAYBACK_STATE_STORAGE_KEY);
  if (!cachedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(cachedValue) as unknown;
    return isPlaybackStateForTracks(parsed, tracks) ? parsed : null;
  } catch {
    return null;
  }
}

function removePlaybackStateForTrack(trackId: string) {
  const cachedValue = localStorage.getItem(PLAYBACK_STATE_STORAGE_KEY);
  if (!cachedValue) {
    return;
  }

  try {
    const parsed = JSON.parse(cachedValue) as PlaybackState;
    if (parsed.trackId === trackId) {
      localStorage.removeItem(PLAYBACK_STATE_STORAGE_KEY);
      return;
    }

    localStorage.setItem(
      PLAYBACK_STATE_STORAGE_KEY,
      JSON.stringify({
        ...parsed,
        queueTrackIds: parsed.queueTrackIds.filter((queuedTrackId) => queuedTrackId !== trackId)
      })
    );
  } catch {
    localStorage.removeItem(PLAYBACK_STATE_STORAGE_KEY);
  }
}

function sortTracksByTitle(tracks: Track[]) {
  return [...tracks].sort((first, second) => first.title.localeCompare(second.title));
}

function isPlaybackStateForTracks(value: unknown, tracks: Track[]): value is PlaybackState {
  if (!isRecord(value)) {
    return false;
  }

  const trackIds = new Set(tracks.map((track) => track.id));
  return (
    typeof value.trackId === "string" &&
    trackIds.has(value.trackId) &&
    typeof value.currentTime === "number" &&
    Number.isFinite(value.currentTime) &&
    value.currentTime >= 0 &&
    Array.isArray(value.queueTrackIds) &&
    value.queueTrackIds.every((trackId) => typeof trackId === "string") &&
    typeof value.isPlayQueueExplicit === "boolean" &&
    typeof value.playlistLabel === "string"
  );
}

function clampPlaybackTime(time: number, duration: number) {
  if (!Number.isFinite(time) || time < 0) {
    return 0;
  }

  if (Number.isFinite(duration) && duration > 0) {
    return Math.min(time, duration);
  }

  return time;
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
