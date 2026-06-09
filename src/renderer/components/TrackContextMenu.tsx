import { Edit3, FileText, FolderOpen, Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import type { Track } from "../../shared/types";

interface TrackContextMenuProps {
  track: Track;
  position: { x: number; y: number };
  busy: boolean;
  onClose: () => void;
  onShowInFolder: () => void;
  onEdit: () => void;
  onDeleteLyrics: () => void;
  onDeleteTrack: () => void;
}

const menuWidth = 236;
const menuHeight = 184;
const viewportPadding = 10;

export function TrackContextMenu({
  track,
  position,
  busy,
  onClose,
  onShowInFolder,
  onEdit,
  onDeleteLyrics,
  onDeleteTrack
}: TrackContextMenuProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const style = useMemo(() => {
    const left = Math.min(position.x, window.innerWidth - menuWidth - viewportPadding);
    const top = Math.min(position.y, window.innerHeight - menuHeight - viewportPadding);
    return { left: Math.max(viewportPadding, left), top: Math.max(viewportPadding, top) };
  }, [position.x, position.y]);

  const canDeleteLyrics = Boolean(track.hasLyrics && track.lyricsPath);

  return (
    <div className="context-menu-layer" onMouseDown={onClose}>
      <div className="track-context-menu" role="menu" style={style} onMouseDown={(event) => event.stopPropagation()}>
        <button role="menuitem" type="button" disabled={busy} onClick={onShowInFolder}>
          <FolderOpen size={16} />
          打开文件位置
        </button>
        <button role="menuitem" type="button" disabled={busy} onClick={onEdit}>
          <Edit3 size={16} />
          编辑音乐信息
        </button>
        <button role="menuitem" type="button" disabled={busy || !canDeleteLyrics} onClick={onDeleteLyrics}>
          <FileText size={16} />
          删除当前歌词
        </button>
        <button className="danger" role="menuitem" type="button" disabled={busy} onClick={onDeleteTrack}>
          <Trash2 size={16} />
          删除当前音乐文件
        </button>
      </div>
    </div>
  );
}
