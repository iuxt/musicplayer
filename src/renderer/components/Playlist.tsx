import { ListMusic, Trash2, X } from "lucide-react";
import { memo } from "react";
import type { Track } from "../../shared/types";
import { VirtualizedList } from "./VirtualizedList";

interface PlaylistProps {
  tracks: Track[];
  currentTrack: Track | null;
  label: string;
  onSelectTrack: (track: Track) => void;
  onClear: () => void;
  onRemoveTrack: (track: Track) => void;
}

export const Playlist = memo(function Playlist({ tracks, currentTrack, label, onSelectTrack, onClear, onRemoveTrack }: PlaylistProps) {
  return (
    <section className="playlist-panel" aria-label="Playlist">
      <div className="playlist-heading">
        <div>
          <p className="eyebrow">Queue</p>
          <h2>Playlist</h2>
        </div>
        <div className="playlist-heading-actions">
          {tracks.length > 0 ? (
            <button aria-label="Clear playlist" className="playlist-icon-button" onClick={onClear} title="Clear playlist" type="button">
              <Trash2 size={16} />
            </button>
          ) : null}
          <ListMusic size={18} />
        </div>
      </div>
      <p className="playlist-label">{label}</p>

      <VirtualizedList
        className="playlist-list"
        estimatedRowHeight={58}
        items={tracks}
        getKey={(track) => track.id}
        emptyState={<p className="playlist-empty">Queue is empty</p>}
        renderItem={(track, index) => {
          const rowNumber = String(index + 1).padStart(2, "0");

          return (
            <div className={`playlist-row ${currentTrack?.id === track.id ? "active" : ""}`}>
              <button className="playlist-track-button" onClick={() => onSelectTrack(track)} type="button">
                <span className="playlist-row-index">{rowNumber}</span>
                <strong>{track.title}</strong>
                <small>{track.artist}</small>
              </button>
              <button
                aria-label={`Remove ${track.title} from playlist`}
                className="playlist-icon-button playlist-remove-button"
                onClick={() => onRemoveTrack(track)}
                title={`Remove ${track.title} from playlist`}
                type="button"
              >
                <X size={14} />
              </button>
            </div>
          );
        }}
      />
    </section>
  );
});
