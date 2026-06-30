import { Plus, X } from "lucide-react";
import type { LibraryPlaylist, Track } from "../../shared/types";

interface AddToPlaylistDialogProps {
  track: Track;
  playlists: LibraryPlaylist[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onCreatePlaylist: () => void;
  onAddToPlaylist: (playlist: LibraryPlaylist) => void;
}

export function AddToPlaylistDialog({
  track,
  playlists,
  busy,
  error,
  onClose,
  onCreatePlaylist,
  onAddToPlaylist
}: AddToPlaylistDialogProps) {
  return (
    <div className="modal-layer" role="presentation">
      <section className="add-playlist-dialog" role="dialog" aria-modal="true" aria-label="添加到播放列表">
        <div className="metadata-dialog-heading">
          <h2>添加到播放列表</h2>
          <button type="button" aria-label="关闭添加到播放列表" onClick={onClose} disabled={busy}>
            <X size={16} />
          </button>
        </div>

        <div className="add-playlist-track">
          <strong>{track.title}</strong>
          <span>{track.artist}</span>
        </div>

        <button className="add-playlist-create-button" type="button" onClick={onCreatePlaylist} disabled={busy}>
          <Plus size={16} />
          新建播放列表
        </button>

        <div className="add-playlist-list">
          {playlists.length > 0 ? (
            playlists.map((playlist) => (
              <button
                className="playlist-choice-button"
                key={playlist.id}
                type="button"
                onClick={() => onAddToPlaylist(playlist)}
                disabled={busy}
              >
                <span>{playlist.name}</span>
                <small>{playlist.trackIds.length} 首歌曲</small>
              </button>
            ))
          ) : (
            <p className="add-playlist-empty">暂无播放列表</p>
          )}
        </div>

        {error ? <p className="metadata-dialog-error">{error}</p> : null}
      </section>
    </div>
  );
}
