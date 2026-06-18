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
    <section className="playlist-panel" aria-label="播放列表">
      <div className="playlist-heading">
        <div>
          <p className="eyebrow">队列</p>
          <h2>播放列表</h2>
        </div>
        <div className="playlist-heading-actions">
          {tracks.length > 0 ? (
            <button aria-label="清空播放列表" className="playlist-icon-button" onClick={onClear} title="清空播放列表" type="button">
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
        emptyState={<p className="playlist-empty">队列为空</p>}
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
                aria-label={`从播放列表移除 ${track.title}`}
                className="playlist-icon-button playlist-remove-button"
                onClick={() => onRemoveTrack(track)}
                title={`从播放列表移除 ${track.title}`}
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
