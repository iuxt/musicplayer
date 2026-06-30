import { Edit3, Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";

interface PlaylistContextMenuProps {
  position: { x: number; y: number };
  busy: boolean;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}

const menuWidth = 236;
const menuHeight = 92;
const viewportPadding = 10;

export function PlaylistContextMenu({ position, busy, onClose, onRename, onDelete }: PlaylistContextMenuProps) {
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
        <button role="menuitem" type="button" disabled={busy} onClick={onRename}>
          <Edit3 size={16} />
          重命名播放列表
        </button>
        <button className="danger" role="menuitem" type="button" disabled={busy} onClick={onDelete}>
          <Trash2 size={16} />
          删除播放列表
        </button>
      </div>
    </div>
  );
}
