import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "../../shared/types";

export type RepeatMode = "off" | "all" | "one";

export function useAudioPlayer(queue: Track[]) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nextRef = useRef<() => Promise<void>>(async () => undefined);
  const playbackGenerationRef = useRef(0);
  const handledEndGenerationRef = useRef<number | null>(null);
  const shouldAutoSelectRef = useRef(true);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(queue[0] ?? null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.82);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const currentIndex = useMemo(() => {
    if (!currentTrack) {
      return -1;
    }
    return queue.findIndex((track) => track.id === currentTrack.id);
  }, [currentTrack, queue]);

  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    const handleEnded = () => {
      const playbackGeneration = playbackGenerationRef.current;
      if (handledEndGenerationRef.current === playbackGeneration) {
        return;
      }

      handledEndGenerationRef.current = playbackGeneration;
      void nextRef.current();
    };
    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      if (hasPlaybackReachedEnd(audio)) {
        handleEnded();
      }
    };
    const updateDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const handleError = () => {
      setPlaybackError("无法播放这首歌曲。");
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, []);

  useEffect(() => {
    if (!currentTrack && queue.length > 0 && shouldAutoSelectRef.current) {
      setCurrentTrack(queue[0]);
    }
  }, [currentTrack, queue]);

  const loadTrack = useCallback(async (track: Track, autoplay: boolean) => {
    const audio = audioRef.current;
    if (!audio) {
      setCurrentTrack(track);
      return;
    }

    setPlaybackError(null);
    shouldAutoSelectRef.current = true;
    const url = await window.musicApi.getPlayableUrl(track.filePath);
    playbackGenerationRef.current += 1;
    audio.src = url;
    audio.currentTime = 0;
    setCurrentTime(0);
    setCurrentTrack(track);

    if (autoplay) {
      await audio.play();
      setIsPlaying(true);
    }
  }, []);

  const selectTrack = useCallback(
    async (track: Track) => {
      await loadTrack(track, isPlaying);
    },
    [isPlaying, loadTrack]
  );

  const playTrack = useCallback(
    async (track: Track) => {
      await loadTrack(track, true);
    },
    [loadTrack]
  );

  const restoreTrack = useCallback(async (track: Track, time: number) => {
    const audio = audioRef.current;
    const restoredTime = Number.isFinite(time) ? Math.max(0, time) : 0;

    setPlaybackError(null);
    shouldAutoSelectRef.current = true;
    setCurrentTrack(track);
    setCurrentTime(restoredTime);
    setIsPlaying(false);

    if (!audio) {
      return;
    }

    const url = await window.musicApi.getPlayableUrl(track.filePath);
    audio.src = url;
    audio.currentTime = restoredTime;
    audio.pause();
  }, []);

  const playPause = useCallback(async () => {
    const audio = audioRef.current;
    const track = currentTrack ?? queue[0] ?? null;
    if (!track || !audio) {
      return;
    }

    if (!audio.src) {
      await loadTrack(track, true);
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    await audio.play();
    setIsPlaying(true);
  }, [currentTrack, isPlaying, loadTrack, queue]);

  const next = useCallback(async () => {
    if (queue.length === 0) {
      return;
    }

    if (repeat === "one" && currentTrack) {
      await loadTrack(currentTrack, isPlaying);
      return;
    }

    const nextIndex = shuffle
      ? randomQueueIndex(queue.length, currentIndex)
      : currentIndex >= queue.length - 1
        ? repeat === "all"
          ? 0
          : currentIndex
        : currentIndex + 1;

    await loadTrack(queue[Math.max(nextIndex, 0)], isPlaying);
  }, [currentIndex, currentTrack, isPlaying, loadTrack, queue, repeat, shuffle]);

  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  const previous = useCallback(async () => {
    if (queue.length === 0) {
      return;
    }

    const previousIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
    await loadTrack(queue[previousIndex], isPlaying);
  }, [currentIndex, isPlaying, loadTrack, queue]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setVolume = useCallback((nextVolume: number) => {
    const clamped = Math.min(1, Math.max(0, nextVolume));
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    setVolumeState(clamped);
  }, []);

  const toggleShuffle = useCallback(() => setShuffle((value) => !value), []);
  const toggleRepeat = useCallback(() => {
    setRepeat((mode) => (mode === "off" ? "all" : mode === "all" ? "one" : "off"));
  }, []);
  const cyclePlaybackMode = useCallback(() => {
    if (shuffle) {
      setShuffle(false);
      setRepeat("all");
      return;
    }

    if (repeat === "off") {
      setShuffle(true);
      return;
    }

    setRepeat((mode) => (mode === "all" ? "one" : "off"));
  }, [repeat, shuffle]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    shouldAutoSelectRef.current = false;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const replaceCurrentTrack = useCallback((track: Track) => {
    setCurrentTrack((current) => (current?.id === track.id ? track : current));
  }, []);

  return {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    shuffle,
    repeat,
    playbackError,
    selectTrack,
    playTrack,
    restoreTrack,
    playPause,
    next,
    previous,
    seek,
    setVolume,
    toggleShuffle,
    toggleRepeat,
    cyclePlaybackMode,
    stop,
    replaceCurrentTrack
  };
}

function randomQueueIndex(length: number, currentIndex: number) {
  if (length <= 1) {
    return 0;
  }

  let index = currentIndex;
  while (index === currentIndex) {
    index = Math.floor(Math.random() * length);
  }
  return index;
}

function hasPlaybackReachedEnd(audio: HTMLAudioElement) {
  return Number.isFinite(audio.duration) && audio.duration > 0 && audio.currentTime >= audio.duration;
}
