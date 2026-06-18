import { Disc3, Folder, ListMusic, Mic2, Music2, Settings } from "lucide-react";
import { libraryCategories, type LibraryCategory } from "../libraryCategories";

interface SidebarProps {
  trackCount: number;
  activeCategory: LibraryCategory;
  activeView: "library" | "settings";
  onCategoryChange: (category: LibraryCategory) => void;
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
  activeCategory,
  activeView,
  onCategoryChange,
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
              className={`nav-item ${activeView === "library" && activeCategory === category.id ? "active" : ""}`}
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

      <div className="sidebar-footer">
        <button className={`nav-item ${activeView === "settings" ? "active" : ""}`} onClick={onSettingsOpen} type="button">
          <Settings size={18} />
          设置
        </button>
      </div>
    </aside>
  );
}
