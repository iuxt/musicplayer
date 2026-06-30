import { Disc3, Folder, ListMusic, Mic2, Music2, Plus, Settings } from "lucide-react";
import type { LibraryPlaylist } from "../../shared/types";
import { libraryCategories, type LibraryCategory } from "../libraryCategories";

interface SidebarProps {
  trackCount: number;
  playlists: LibraryPlaylist[];
  activeCategory: LibraryCategory;
  activePlaylistId: string | null;
  activeView: "library" | "settings";
  onCategoryChange: (category: LibraryCategory) => void;
  onCreatePlaylist: () => void;
  onPlaylistChange: (playlistId: string) => void;
  onPlaylistContextMenu: (playlist: LibraryPlaylist, position: { x: number; y: number }) => void;
  onSettingsOpen: () => void;
}

const categoryIcons = {
  songs: ListMusic,
  albums: Disc3,
  artists: Mic2,
  folders: Folder
};

export function Sidebar({
  trackCount,
  playlists,
  activeCategory,
  activePlaylistId,
  activeView,
  onCategoryChange,
  onCreatePlaylist,
  onPlaylistChange,
  onPlaylistContextMenu,
  onSettingsOpen
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Music2 size={20} />
        </div>
        <div>
          <strong>本地音乐</strong>
          <span>{trackCount} 首歌曲</span>
        </div>
      </div>

      <nav className="nav-list" aria-label="音乐库">
        {libraryCategories.map((category) => {
          const Icon = categoryIcons[category.id];

          return (
            <button
              className={`nav-item ${activeView === "library" && !activePlaylistId && activeCategory === category.id ? "active" : ""}`}
              key={category.id}
              onClick={() => onCategoryChange(category.id)}
              type="button"
            >
              <Icon size={18} />
              {category.label}
            </button>
          );
        })}
      </nav>

      <nav className="nav-list sidebar-playlists" aria-label="播放列表">
        <div className="sidebar-nav-heading">
          <p className="sidebar-nav-label">播放列表</p>
          <button
            aria-label="新建播放列表"
            className="sidebar-icon-button"
            onClick={onCreatePlaylist}
            title="新建播放列表"
            type="button"
          >
            <Plus size={14} />
          </button>
        </div>
        {playlists.length > 0 ? (
          playlists.map((playlist) => (
            <button
              className={`nav-item sidebar-playlist-item ${activeView === "library" && activePlaylistId === playlist.id ? "active" : ""}`}
              key={playlist.id}
              onClick={() => onPlaylistChange(playlist.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                onPlaylistContextMenu(playlist, { x: event.clientX, y: event.clientY });
              }}
              type="button"
            >
              <ListMusic size={18} />
              <span className="sidebar-playlist-copy">
                <span>{playlist.name}</span>
                <small>{playlist.trackIds.length} 首歌曲</small>
              </span>
            </button>
          ))
        ) : (
          <p className="sidebar-empty">暂无播放列表</p>
        )}
      </nav>

      <div className="sidebar-footer">
        <button className={`nav-item ${activeView === "settings" ? "active" : ""}`} onClick={onSettingsOpen} type="button">
          <Settings size={18} />
          设置
        </button>
      </div>
    </aside>
  );
}
