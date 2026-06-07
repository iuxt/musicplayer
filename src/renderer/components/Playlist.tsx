import { ListMusic } from "lucide-react";
import type { Track } from "../../shared/types";

interface PlaylistProps {
  tracks: Track[];
  currentTrack: Track | null;
  label: string;
  onSelectTrack: (track: Track) => void;
}

export function Playlist({ tracks, currentTrack, label, onSelectTrack }: PlaylistProps) {
  return (
    <section className="playlist-panel" aria-label="Playlist">
      <div className="playlist-heading">
        <div>
          <p className="eyebrow">Queue</p>
          <h2>Playlist</h2>
        </div>
        <ListMusic size={18} />
      </div>
      <p className="playlist-label">{label}</p>

      <div className="playlist-list">
        {tracks.map((track, index) => (
          <button
            className={`playlist-row ${currentTrack?.id === track.id ? "active" : ""}`}
            key={track.id}
            onClick={() => onSelectTrack(track)}
            type="button"
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{track.title}</strong>
            <small>{track.artist}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
