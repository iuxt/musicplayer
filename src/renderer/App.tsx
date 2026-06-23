import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScanProgress, ScanResult, ScanWarning, Track, TrackMetadataUpdate } from "../shared/types";
import { type AppSettings, normalizeAppSettings, readAppSettings, writeAppSettings } from "./appSettings";
import { EditTrackMetadataDialog } from "./components/EditTrackMetadataDialog";
import { EmptyState } from "./components/EmptyState";
import { FullscreenLyrics } from "./components/FullscreenLyrics";
import { LibraryList } from "./components/LibraryList";
import { PlayerBar } from "./components/PlayerBar";
import { Playlist } from "./components/Playlist";
import { ScanningState } from "./components/ScanningState";
import { SettingsPage } from "./components/SettingsPage";
import { Sidebar } from "./components/Sidebar";
import { TrackContextMenu } from "./components/TrackContextMenu";
import { getParentFolderPath, getTracksAtFolderLevel } from "./folderBrowser";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import type { LibraryCategory } from "./libraryCategories";
import { buildDesktopLyricsPayload } from "./lyrics";

const LAST_FOLDER_STORAGE_KEY = "musicplayer:last-folder";
const PLAYBACK_STATE_STORAGE_KEY = "musicplayer:playback-state";
const PLAYBACK_PROGRESS_SAVE_INTERVAL_MS = 5000;
const DEFAULT_PLAYLIST_LABEL = "音乐库";
const DEFAULT_FOLDER_PLAYLIST_LABEL = "文件夹";

function getFileNameForDisplay(filePath: string) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const segments = normalizedPath.split("/").filter(Boolean);
  return segments[segments.length - 1] || filePath;
}

type PlaybackState = {
  trackId: string;
  currentTime: number;
  queueTrackIds: string[];
  isPlayQueueExplicit: boolean;
  playlistLabel: string;
};

type AppView = "library" | "settings";
type MediaKeyCommand = "play-pause" | "next" | "previous";

export function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [warnings, setWarnings] = useState<ScanWarning[]>([]);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>("songs");
  const [activeView, setActiveView] = useState<AppView>("library");
  const [appSettings, setAppSettings] = useState<AppSettings>(() => readAppSettings());
  const [availableFontFamilies, setAvailableFontFamilies] = useState<string[]>([""]);
  const [cacheStatus, setCacheStatus] = useState<string | null>(null);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [playQueue, setPlayQueue] = useState<Track[]>([]);
  const [isPlayQueueExplicit, setIsPlayQueueExplicit] = useState(false);
  const [playlistLabel, setPlaylistLabel] = useState(DEFAULT_PLAYLIST_LABEL);
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
  const [hasLoadedSystemFonts, setHasLoadedSystemFonts] = useState(false);
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
  const stoppedBeforeTrashTrackIdRef = useRef<string | null>(null);

  const loadLibraryResult = useCallback((result: ScanResult) => {
    setFolderPath(result.folderPath);
    setTracks(result.tracks);
    setWarnings(result.warnings);
    setPlayQueue(result.tracks);
    setIsPlayQueueExplicit(false);
    setPlaylistLabel(DEFAULT_PLAYLIST_LABEL);
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
    setPlaylistLabel(localizePlaylistLabel(playbackState.playlistLabel));
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

  const player = useAudioPlayer(playlistTracks, {
    volume: appSettings.volume,
    shuffle: appSettings.shuffle,
    repeat: appSettings.repeat
  });
  const playerRef = useRef(player);
  playerRef.current = player;

  const commitAppSettings = useCallback((updater: (currentSettings: AppSettings) => AppSettings) => {
    setAppSettings((currentSettings) => {
      const nextSettings = normalizeAppSettings(updater(currentSettings));
      try {
        writeAppSettings(nextSettings);
      } catch {
        setAppError("无法保存设置。");
      }
      return nextSettings;
    });
  }, []);

  const persistLibraryCache = useCallback(async (result: ScanResult) => {
    try {
      await window.musicApi.writeLibraryCache(result);
    } catch {
      setAppError("无法保存音乐库缓存。");
    }
  }, []);

  const changeFullscreenLyricsFontFamily = useCallback(
    (fontFamily: string) => {
      commitAppSettings((currentSettings) => ({ ...currentSettings, fullscreenLyricsFontFamily: fontFamily }));
    },
    [commitAppSettings]
  );

  const changeFullscreenLyricsFontSize = useCallback(
    (fontSize: number) => {
      commitAppSettings((currentSettings) => ({ ...currentSettings, fullscreenLyricsFontSize: fontSize }));
    },
    [commitAppSettings]
  );

  const changeSystemMediaShortcutsEnabled = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        commitAppSettings((currentSettings) => ({ ...currentSettings, systemMediaShortcutsEnabled: false }));
        return;
      }

      void window.musicApi
        .ensureSystemMediaShortcutsPermission()
        .then((result) => {
          if (!result.ok) {
            return;
          }

          commitAppSettings((currentSettings) => ({ ...currentSettings, systemMediaShortcutsEnabled: true }));
        })
        .catch(() => {
          setAppError("无法检查系统媒体快捷键权限。");
        });
    },
    [commitAppSettings]
  );

  const changeCloseWindowStopsPlayback = useCallback(
    (enabled: boolean) => {
      commitAppSettings((currentSettings) => ({ ...currentSettings, closeWindowStopsPlayback: enabled }));
    },
    [commitAppSettings]
  );

  const changeDesktopLyricsEnabled = useCallback(
    (enabled: boolean) => {
      commitAppSettings((currentSettings) => ({ ...currentSettings, desktopLyricsEnabled: enabled }));
    },
    [commitAppSettings]
  );

  const changeDesktopLyricsFontFamily = useCallback(
    (fontFamily: string) => {
      commitAppSettings((currentSettings) => ({ ...currentSettings, desktopLyricsFontFamily: fontFamily }));
    },
    [commitAppSettings]
  );

  const changeDesktopLyricsFontSize = useCallback(
    (fontSize: number) => {
      commitAppSettings((currentSettings) => ({ ...currentSettings, desktopLyricsFontSize: fontSize }));
    },
    [commitAppSettings]
  );

  const changeVolume = useCallback(
    (volume: number) => {
      const nextVolume = player.setVolume(volume);
      commitAppSettings((currentSettings) => ({ ...currentSettings, volume: nextVolume }));
    },
    [commitAppSettings, player.setVolume]
  );

  const changePlaybackMode = useCallback(() => {
    const nextMode = player.cyclePlaybackMode();
    commitAppSettings((currentSettings) => ({ ...currentSettings, ...nextMode }));
  }, [commitAppSettings, player.cyclePlaybackMode]);

  const openSettings = useCallback(() => {
    setActiveView("settings");
    setCacheStatus(null);
    setCacheError(null);
  }, []);

  useEffect(() => {
    if (activeView !== "settings" || hasLoadedSystemFonts) {
      return;
    }

    let cancelled = false;
    void window.musicApi
      .listSystemFonts()
      .then((fontFamilies) => {
        if (!cancelled) {
          setAvailableFontFamilies(fontFamilies.length > 0 ? fontFamilies : [""]);
          setHasLoadedSystemFonts(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableFontFamilies(["", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "LXGW WenKai", "Arial", "Helvetica"]);
          setHasLoadedSystemFonts(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeView, hasLoadedSystemFonts]);

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
      await persistLibraryCache(result);
    } catch (error) {
      setAppError(error instanceof Error ? error.message : "无法扫描文件夹。");
    } finally {
      setIsScanning(false);
    }
  }, [loadLibraryResult, persistLibraryCache]);

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
      await persistLibraryCache(result);
    } catch (error) {
      setAppError(error instanceof Error ? error.message : "无法重新扫描文件夹。");
    } finally {
      setIsScanning(false);
    }
  }, [folderPath, loadLibraryResult, persistLibraryCache]);

  useEffect(() => {
    return window.musicApi.onScanProgress(setScanProgress);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void window.musicApi
      .setSystemMediaShortcutsEnabled(appSettings.systemMediaShortcutsEnabled)
      .then((result) => {
        if (cancelled || !appSettings.systemMediaShortcutsEnabled || result.ok) {
          return;
        }

        setAppError(`无法启用系统媒体快捷键：${formatMediaKeyCommandLabels(result.failedCommands)}注册失败。`);
        commitAppSettings((currentSettings) => ({ ...currentSettings, systemMediaShortcutsEnabled: false }));
      })
      .catch(() => {
        if (!cancelled) {
          setAppError("无法更新系统媒体快捷键。");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appSettings.systemMediaShortcutsEnabled, commitAppSettings]);

  useEffect(() => {
    void window.musicApi.setCloseWindowStopsPlayback(appSettings.closeWindowStopsPlayback).catch(() => {
      setAppError("无法更新关闭窗口播放设置。");
    });
  }, [appSettings.closeWindowStopsPlayback]);

  useEffect(() => {
    return window.musicApi.onMediaKeyCommand((command) => {
      if (command === "play-pause") {
        void player.playPause();
        return;
      }

      if (command === "next") {
        void player.next();
        return;
      }

      void player.previous();
    });
  }, [player.next, player.playPause, player.previous]);

  useEffect(() => {
    return window.musicApi.onMenuCommand((command) => {
      if (command === "choose-folder") {
        void chooseFolder();
      }
      if (command === "rescan-library") {
        void rescan();
      }
      if (command === "open-settings") {
        openSettings();
      }
    });
  }, [chooseFolder, openSettings, rescan]);

  useEffect(() => {
    const rememberedFolderPath = localStorage.getItem(LAST_FOLDER_STORAGE_KEY);
    if (!rememberedFolderPath) {
      return;
    }

    let cancelled = false;
    void (async () => {
      let cachedResult: unknown | null = null;
      try {
        cachedResult = await window.musicApi.readLibraryCache();
      } catch {
        cachedResult = null;
      }

      if (cancelled) {
        return;
      }

      if (isUsableLibraryCache(cachedResult, rememberedFolderPath)) {
        loadLibraryResult(cachedResult);
        return;
      }

      setFolderPath(rememberedFolderPath);
      setIsScanning(true);
      setAppError(null);
      setScanProgress(null);

      try {
        const result = await window.musicApi.rescanLibrary(rememberedFolderPath);
        if (cancelled) {
          return;
        }
        loadLibraryResult(result);
        await persistLibraryCache(result);
      } catch (error) {
        if (!cancelled) {
          setAppError(error instanceof Error ? error.message : "无法重新打开上次的音乐文件夹。");
        }
      } finally {
        if (!cancelled) {
          setIsScanning(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadLibraryResult, persistLibraryCache]);

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

    void window.musicApi
      .getArtworkUrl(track.artworkPath)
      .then((url) => {
        if (!cancelled) {
          setArtworkUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setArtworkUrl(null);
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

  const desktopLyricsPayload = useMemo(
    () =>
      buildDesktopLyricsPayload({
        track: player.currentTrack,
        lyrics,
        isLyricsLoading,
        currentTime: player.currentTime,
        fontFamily: appSettings.desktopLyricsFontFamily,
        fontSize: appSettings.desktopLyricsFontSize
      }),
    [
      appSettings.desktopLyricsFontFamily,
      appSettings.desktopLyricsFontSize,
      isLyricsLoading,
      lyrics,
      player.currentTime,
      player.currentTrack
    ]
  );

  useEffect(() => {
    if (!appSettings.desktopLyricsEnabled) {
      void window.musicApi.closeDesktopLyrics().catch(() => {
        setAppError("无法关闭桌面歌词。");
      });
      return;
    }

    void window.musicApi.showDesktopLyrics().catch(() => {
      setAppError("无法打开桌面歌词。");
      commitAppSettings((currentSettings) => ({ ...currentSettings, desktopLyricsEnabled: false }));
    });
  }, [appSettings.desktopLyricsEnabled, commitAppSettings]);

  useEffect(() => {
    if (!appSettings.desktopLyricsEnabled) {
      return;
    }

    void window.musicApi.updateDesktopLyrics(desktopLyricsPayload).catch(() => {
      setAppError("无法更新桌面歌词。");
    });
  }, [appSettings.desktopLyricsEnabled, desktopLyricsPayload]);

  useEffect(() => {
    return window.musicApi.onDesktopLyricsClosed(() => {
      commitAppSettings((currentSettings) => ({ ...currentSettings, desktopLyricsEnabled: false }));
    });
  }, [commitAppSettings]);

  const changeCategory = useCallback((category: LibraryCategory) => {
    setActiveView("library");
    setActiveCategory(category);
    if (category !== "folders") {
      setSelectedFolderPath(null);
    }
  }, []);

  const clearLibraryCache = useCallback(() => {
    setCacheStatus(null);
    setCacheError(null);
    void window.musicApi
      .clearLibraryCache()
      .then(() => {
        setCacheStatus("音乐库缓存已清除。");
      })
      .catch(() => {
        setCacheError("无法清除音乐库缓存。");
      });
  }, []);

  const openFolder = useCallback((nextFolderPath: string) => {
    setSelectedFolderPath(nextFolderPath);
  }, []);

  const backFolder = useCallback(() => {
    setSelectedFolderPath(getParentFolderPath(selectedFolderPath));
  }, [selectedFolderPath]);

  const playTrack = useCallback(
    async (track: Track, queueTracks?: Track[]) => {
      if (search.trim() && !queueTracks) {
        if (!playlistTracks.some((queuedTrack) => queuedTrack.id === track.id)) {
          setPlayQueue([...playlistTracks, track]);
          setIsPlayQueueExplicit(true);
        }
        await player.playTrack(track);
        return;
      }

      const nextQueue =
        queueTracks ?? (activeCategory === "folders" ? getTracksAtFolderLevel(filteredTracks, selectedFolderPath) : filteredTracks);
      setPlayQueue(nextQueue);
      setIsPlayQueueExplicit(true);
      setPlaylistLabel(activeCategory === "folders" ? selectedFolderPath ?? DEFAULT_FOLDER_PLAYLIST_LABEL : DEFAULT_PLAYLIST_LABEL);
      await player.playTrack(track);
    },
    [activeCategory, filteredTracks, player.playTrack, playlistTracks, search, selectedFolderPath]
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
          void persistLibraryCache({ folderPath, tracks: nextTracks, warnings });
        }
        return nextTracks;
      });
    },
    [folderPath, persistLibraryCache, warnings]
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

  const removeTrackFromLibrary = useCallback(
    async (trackToRemove: Track) => {
      const currentQueueIndex = playlistTracks.findIndex((queuedTrack) => queuedTrack.id === trackToRemove.id);
      const nextQueue = playlistTracks.filter((queuedTrack) => queuedTrack.id !== trackToRemove.id);
      const nextTrack = currentQueueIndex >= 0 ? nextQueue[currentQueueIndex] ?? null : null;

      commitTracks((currentTracks) => currentTracks.filter((existingTrack) => existingTrack.id !== trackToRemove.id));
      setPlayQueue(nextQueue);
      setIsPlayQueueExplicit(true);
      removePlaybackStateForTrack(trackToRemove.id);

      const currentPlayer = playerRef.current;
      if (stoppedBeforeTrashTrackIdRef.current === trackToRemove.id) {
        if (currentPlayer.currentTrack?.id === trackToRemove.id) {
          setLyrics(null);
          setArtworkUrl(null);
          setIsLyricsLoading(false);
          await currentPlayer.stop();
        }
        return;
      }

      if (currentPlayer.currentTrack?.id !== trackToRemove.id) {
        return;
      }

      setLyrics(null);
      setArtworkUrl(null);
      setIsLyricsLoading(false);
      if (!nextTrack) {
        await currentPlayer.stop();
        return;
      }

      if (currentPlayer.isPlaying) {
        await currentPlayer.playTrack(nextTrack);
      } else {
        await currentPlayer.selectTrack(nextTrack);
      }
    },
    [commitTracks, playlistTracks]
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
      setAppError(error instanceof Error ? error.message : "无法打开文件位置。");
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
        setMetadataError(error instanceof Error ? error.message : "无法更新音乐信息。");
      } finally {
        setPendingMediaAction(false);
      }
    },
    [editingTrack, replaceTrack]
  );

  const deleteTrackFiles = useCallback(
    async (track: Track) => {
      const fileName = getFileNameForDisplay(track.filePath);
      const confirmed = window.confirm(`将把音乐文件“${fileName}”以及同名歌词、同名封面移到废纸篓。是否继续？`);
      if (!confirmed) {
        setTrackMenu(null);
        return;
      }

      setPendingMediaAction(true);
      setAppError(null);
      if (player.currentTrack?.id === track.id) {
        stoppedBeforeTrashTrackIdRef.current = track.id;
        setLyrics(null);
        setArtworkUrl(null);
        setIsLyricsLoading(false);
        await player.stop();
      }

      try {
        const result = await window.musicApi.trashTrackFiles(track);
        if (result.audioRemoved) {
          await removeTrackFromLibrary(track);
        }
        if (!result.ok && result.error) {
          setAppError(result.error);
        }
      } catch (error) {
        setAppError(error instanceof Error ? error.message : "无法将音乐文件移到废纸篓。");
      } finally {
        if (stoppedBeforeTrashTrackIdRef.current === track.id) {
          stoppedBeforeTrashTrackIdRef.current = null;
        }
        setPendingMediaAction(false);
        setTrackMenu(null);
      }
    },
    [player, removeTrackFromLibrary]
  );

  return (
    <div className="app-frame">
      <div className="window-drag-region" aria-hidden="true" />
      <Sidebar
        trackCount={tracks.length}
        activeCategory={activeCategory}
        activeView={activeView}
        onCategoryChange={changeCategory}
        onSettingsOpen={openSettings}
      />

      <main className="main-stage">
        {isScanning ? <ScanningState progress={scanProgress} /> : null}
        {appError ? <div className="app-error">{appError}</div> : null}
        {warnings.length > 0 ? <div className="warning-strip">扫描时跳过了 {warnings.length} 个文件。</div> : null}

        {activeView === "settings" ? (
          <SettingsPage
            folderPath={folderPath}
            isScanning={isScanning}
            availableFontFamilies={availableFontFamilies}
            fullscreenLyricsFontFamily={appSettings.fullscreenLyricsFontFamily}
            fullscreenLyricsFontSize={appSettings.fullscreenLyricsFontSize}
            systemMediaShortcutsEnabled={appSettings.systemMediaShortcutsEnabled}
            closeWindowStopsPlayback={appSettings.closeWindowStopsPlayback}
            desktopLyricsEnabled={appSettings.desktopLyricsEnabled}
            desktopLyricsFontFamily={appSettings.desktopLyricsFontFamily}
            desktopLyricsFontSize={appSettings.desktopLyricsFontSize}
            cacheStatus={cacheStatus}
            cacheError={cacheError}
            onChooseFolder={chooseFolder}
            onRescanLibrary={rescan}
            onClearLibraryCache={clearLibraryCache}
            onFullscreenLyricsFontFamilyChange={changeFullscreenLyricsFontFamily}
            onFullscreenLyricsFontSizeChange={changeFullscreenLyricsFontSize}
            onSystemMediaShortcutsEnabledChange={changeSystemMediaShortcutsEnabled}
            onCloseWindowStopsPlaybackChange={changeCloseWindowStopsPlayback}
            onDesktopLyricsEnabledChange={changeDesktopLyricsEnabled}
            onDesktopLyricsFontFamilyChange={changeDesktopLyricsFontFamily}
            onDesktopLyricsFontSizeChange={changeDesktopLyricsFontSize}
          />
        ) : tracks.length === 0 ? (
          <EmptyState onChooseFolder={chooseFolder} isScanning={isScanning} />
        ) : (
          <div className="library-workspace">
            <LibraryList
              category={activeCategory}
              tracks={visibleTracks}
              currentTrack={player.currentTrack}
              contextMenuTrackId={trackMenu?.track.id ?? null}
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
          fullscreenLyricsFontFamily={appSettings.fullscreenLyricsFontFamily}
          fullscreenLyricsFontSize={appSettings.fullscreenLyricsFontSize}
          onClose={() => setIsFullscreenLyricsOpen(false)}
        />
      ) : null}

      {trackMenu ? (
        <TrackContextMenu
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
        onVolume={changeVolume}
        onPlaybackMode={changePlaybackMode}
      />
    </div>
  );
}

function isUsableLibraryCache(value: unknown, folderPath: string): value is ScanResult {
  return isScanResultForFolder(value, folderPath) && !hasLegacyTemporaryArtworkPaths(value);
}

function hasLegacyTemporaryArtworkPaths(result: ScanResult) {
  return result.tracks.some((track) => isLegacyTemporaryArtworkPath(track.artworkPath));
}

function isLegacyTemporaryArtworkPath(artworkPath: string | null) {
  if (!artworkPath) {
    return false;
  }

  return artworkPath.replace(/\\/g, "/").includes("/musicplayer-artwork/");
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

function localizePlaylistLabel(label: string) {
  if (label === "Library") {
    return DEFAULT_PLAYLIST_LABEL;
  }
  if (label === "Folders") {
    return DEFAULT_FOLDER_PLAYLIST_LABEL;
  }
  return label || DEFAULT_PLAYLIST_LABEL;
}

function formatMediaKeyCommandLabels(commands: MediaKeyCommand[]) {
  const labels = commands.map((command) => mediaKeyCommandLabel(command));
  return labels.length > 0 ? labels.join("、") : "系统媒体快捷键";
}

function mediaKeyCommandLabel(command: MediaKeyCommand) {
  if (command === "play-pause") {
    return "播放/暂停";
  }

  if (command === "next") {
    return "下一首";
  }

  return "上一首";
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
