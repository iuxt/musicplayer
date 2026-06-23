import { Edit3, FolderOpen, Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";

interface TrackContextMenuProps {
  position: { x: number; y: number };
  busy: boolean;
  onClose: () => void;
  onShowInFolder: () => void;
  onEdit: () => void;
  onDeleteTrack: () => void;
}

const menuWidth = 236;
const menuHeight = 140;
const viewportPadding = 10;

export function TrackContextMenu({
  position,
  busy,
  onClose,
  onShowInFolder,
  onEdit,
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
        <button className="danger" role="menuitem" type="button" disabled={busy} onClick={onDeleteTrack}>
          <Trash2 size={16} />
          移到废纸篓
        </button>
      </div>
    </div>
  );
}
