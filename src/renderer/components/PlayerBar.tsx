import { Disc3, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide-react";
import type { Track } from "../../shared/types";
import type { RepeatMode } from "../hooks/useAudioPlayer";

interface PlayerBarProps {
  track: Track | null;
  artworkUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  onOpenNowPlaying: () => void;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolume: (volume: number) => void;
  onPlaybackMode: () => void;
}

export function PlayerBar({
  track,
  artworkUrl,
  isPlaying,
  currentTime,
  duration,
  volume,
  shuffle,
  repeat,
  onOpenNowPlaying,
  onPlayPause,
  onPrevious,
  onNext,
  onSeek,
  onVolume,
  onPlaybackMode
}: PlayerBarProps) {
  const playbackModeLabel = shuffle ? "shuffle" : repeat === "all" ? "repeat all" : repeat === "one" ? "repeat one" : "off";
  const isPlaybackModeActive = shuffle || repeat !== "off";

  return (
    <footer className="player-bar">
      <button
        className="mini-now-playing"
        type="button"
        aria-label="Open fullscreen lyrics"
        onClick={onOpenNowPlaying}
        disabled={!track}
      >
        <span className="mini-cover">
          {artworkUrl ? <img src={artworkUrl} alt={track ? `${track.album} cover` : "Album cover"} /> : <Disc3 size={22} />}
        </span>
        <span className="mini-track-copy">
          <strong>{track?.title ?? "Nothing playing"}</strong>
          <small>{track?.artist ?? "Choose a track"}</small>
        </span>
      </button>

      <div className="transport">
        <button className="icon-button" onClick={onPrevious} type="button" aria-label="Previous">
          <SkipBack size={20} />
        </button>
        <button className="play-button" onClick={onPlayPause} type="button" aria-label={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
        </button>
        <button className="icon-button" onClick={onNext} type="button" aria-label="Next">
          <SkipForward size={20} />
        </button>
        <button
          className={isPlaybackModeActive ? "icon-button active" : "icon-button"}
          onClick={onPlaybackMode}
          type="button"
          aria-label={`Playback mode: ${playbackModeLabel}`}
        >
          {shuffle ? <Shuffle size={18} /> : <Repeat size={18} />}
          {repeat === "one" ? <span className="repeat-one">1</span> : null}
        </button>
      </div>

      <div className="timeline">
        <span>{formatTime(currentTime)}</span>
        <input
          aria-label="Seek"
          type="range"
          min="0"
          max={duration || 0}
          step="1"
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <span>{formatTime(duration)}</span>
      </div>

      <label className="volume-control">
        <Volume2 size={18} />
        <input
          aria-label="Volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => onVolume(Number(event.target.value))}
        />
      </label>
    </footer>
  );
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
