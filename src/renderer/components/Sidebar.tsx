import { Disc3, Folder, ListMusic, Mic2, Music2 } from "lucide-react";
import { libraryCategories, type LibraryCategory } from "../libraryCategories";

interface SidebarProps {
  folderPath: string | null;
  trackCount: number;
  activeCategory: LibraryCategory;
  onCategoryChange: (category: LibraryCategory) => void;
}

const categoryIcons = {
  songs: ListMusic,
  albums: Disc3,
  artists: Mic2,
  folders: Folder
};

export function Sidebar({ folderPath, trackCount, activeCategory, onCategoryChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Music2 size={20} />
        </div>
        <div>
          <strong>Local Music</strong>
          <span>{trackCount} tracks</span>
        </div>
      </div>

      <nav className="nav-list" aria-label="Library">
        {libraryCategories.map((category) => {
          const Icon = categoryIcons[category.id];

          return (
            <button
              className={`nav-item ${activeCategory === category.id ? "active" : ""}`}
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

      {folderPath ? <p className="folder-path">{folderPath}</p> : null}
    </aside>
  );
}
