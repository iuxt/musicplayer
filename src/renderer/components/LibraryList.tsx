import { ChevronLeft, Search } from "lucide-react";
import type { Track } from "../../shared/types";
import type { LibraryCategory } from "../libraryCategories";

interface LibraryListProps {
  category: LibraryCategory;
  tracks: Track[];
  currentTrack: Track | null;
  search: string;
  selectedFolderPath: string | null;
  onSearchChange: (value: string) => void;
  onSelectTrack: (track: Track) => void;
  onOpenFolder: (folderPath: string) => void;
  onBackToFolders: () => void;
}

const headings: Record<LibraryCategory, string> = {
  songs: "Songs",
  albums: "Albums",
  artists: "Artists",
  folders: "Folders"
};

export function LibraryList({
  category,
  tracks,
  currentTrack,
  search,
  selectedFolderPath,
  onSearchChange,
  onSelectTrack,
  onOpenFolder,
  onBackToFolders
}: LibraryListProps) {
  const isFolderDetail = category === "folders" && Boolean(selectedFolderPath);
  const groups = category === "songs" ? [] : buildGroups(tracks, category);
  const heading = isFolderDetail ? selectedFolderPath : headings[category];

  return (
    <section className="library-panel" aria-label="Library browser">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Library</p>
          <h2>{heading}</h2>
        </div>
        <label className="search-box">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search songs, artists, albums"
          />
        </label>
      </div>

      {isFolderDetail ? (
        <button className="back-button" onClick={onBackToFolders} type="button">
          <ChevronLeft size={16} />
          Folders
        </button>
      ) : null}

      <div className="track-list">
        {category === "songs" || isFolderDetail
          ? tracks.map((track, index) => (
              <button
                className={`track-row ${currentTrack?.id === track.id ? "active" : ""}`}
                key={track.id}
                onClick={() => onSelectTrack(track)}
                type="button"
              >
                <span className="track-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="track-title">
                  <strong>{track.title}</strong>
                  <small>{track.artist}</small>
                </span>
                <span className="track-album">{track.album}</span>
                <span className="track-duration">{formatDuration(track.duration)}</span>
              </button>
            ))
          : groups.map((group, index) => (
              <button
                className="track-row category-row"
                key={group.key}
                onClick={() => {
                  if (category === "folders") {
                    onOpenFolder(group.label);
                    return;
                  }
                  onSelectTrack(group.tracks[0]);
                }}
                type="button"
              >
                <span className="track-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="track-title">
                  <strong>{group.label}</strong>
                  <small>{group.detail}</small>
                </span>
                <span className="track-album">{group.tracks.length} songs</span>
                <span className="track-duration">Play</span>
              </button>
            ))}
      </div>
    </section>
  );
}

function buildGroups(tracks: Track[], category: Exclude<LibraryCategory, "songs">) {
  const groups = new Map<string, Track[]>();

  for (const track of tracks) {
    const label = getGroupLabel(track, category);
    const key = label.toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.push(track);
    } else {
      groups.set(key, [track]);
    }
  }

  return [...groups.entries()]
    .map(([key, groupTracks]) => {
      const label = getGroupLabel(groupTracks[0], category);
      const related = getGroupDetail(groupTracks, category);

      return {
        key,
        label,
        detail: related,
        tracks: groupTracks
      };
    })
    .sort((first, second) => first.label.localeCompare(second.label));
}

function getGroupLabel(track: Track, category: Exclude<LibraryCategory, "songs">) {
  if (category === "albums") {
    return track.album;
  }
  if (category === "artists") {
    return track.artist;
  }
  return track.folderPath || "Music Folder";
}

function getGroupDetail(tracks: Track[], category: Exclude<LibraryCategory, "songs">) {
  if (category === "albums") {
    return unique(tracks.map((track) => track.artist)).join(", ");
  }
  if (category === "artists") {
    return unique(tracks.map((track) => track.album)).join(", ");
  }
  return unique(tracks.map((track) => track.album)).join(", ");
}

function unique(values: string[]) {
  return [...new Set(values)].filter(Boolean);
}

function formatDuration(duration: number) {
  if (!duration) {
    return "--:--";
  }
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
