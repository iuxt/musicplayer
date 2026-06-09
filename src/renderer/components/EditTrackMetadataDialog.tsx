import { X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type { Track, TrackMetadataUpdate } from "../../shared/types";

interface EditTrackMetadataDialogProps {
  track: Track;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (metadata: TrackMetadataUpdate) => void;
}

export function EditTrackMetadataDialog({ track, busy, error, onCancel, onSave }: EditTrackMetadataDialogProps) {
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [album, setAlbum] = useState(track.album);
  const [trackNumber, setTrackNumber] = useState(track.trackNumber?.toString() ?? "");

  const validationError = useMemo(() => {
    if (!title.trim()) {
      return "标题不能为空";
    }
    if (!artist.trim()) {
      return "歌手不能为空";
    }
    if (!album.trim()) {
      return "专辑不能为空";
    }
    if (trackNumber.trim() && (!/^\d+$/.test(trackNumber.trim()) || Number(trackNumber) <= 0)) {
      return "曲号必须是正整数";
    }
    return null;
  }, [album, artist, title, trackNumber]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (validationError) {
      return;
    }

    onSave({
      title: title.trim(),
      artist: artist.trim(),
      album: album.trim(),
      trackNumber: trackNumber.trim() ? Number(trackNumber.trim()) : null
    });
  };

  return (
    <div className="modal-layer" role="presentation">
      <form className="metadata-dialog" aria-label="编辑音乐信息" onSubmit={submit}>
        <div className="metadata-dialog-heading">
          <h2>编辑音乐信息</h2>
          <button type="button" aria-label="关闭编辑音乐信息" onClick={onCancel} disabled={busy}>
            <X size={16} />
          </button>
        </div>
        <label>
          标题
          <input value={title} onChange={(event) => setTitle(event.target.value)} disabled={busy} />
        </label>
        <label>
          歌手
          <input value={artist} onChange={(event) => setArtist(event.target.value)} disabled={busy} />
        </label>
        <label>
          专辑
          <input value={album} onChange={(event) => setAlbum(event.target.value)} disabled={busy} />
        </label>
        <label>
          曲号
          <input inputMode="numeric" value={trackNumber} onChange={(event) => setTrackNumber(event.target.value)} disabled={busy} />
        </label>
        {validationError || error ? <p className="metadata-dialog-error">{validationError ?? error}</p> : null}
        <div className="metadata-dialog-actions">
          <button type="button" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button type="submit" disabled={busy || Boolean(validationError)}>
            保存
          </button>
        </div>
      </form>
    </div>
  );
}
