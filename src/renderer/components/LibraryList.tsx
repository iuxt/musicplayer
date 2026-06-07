import { ChevronLeft, Search } from "lucide-react";
import type { Track } from "../../shared/types";
import { buildFolderBrowserRows } from "../folderBrowser";
import type { LibraryCategory } from "../libraryCategories";

interface LibraryListProps {
  category: LibraryCategory;
  tracks: Track[];
  currentTrack: Track | null;
  search: string;
  selectedFolderPath: string | null;
  onSearchChange: (value: string) => void;
  onSelectTrack: (track: Track, queueTracks?: Track[]) => void;
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
  const groups = category !== "songs" && category !== "folders" ? buildGroups(tracks, category) : [];
  const folderRows = category === "folders" ? buildFolderBrowserRows(tracks, selectedFolderPath) : [];
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
        {category === "songs"
          ? tracks.map((track, index) => (
              <TrackRow currentTrack={currentTrack} index={index} key={track.id} onSelectTrack={onSelectTrack} track={track} />
            ))
          : null}

        {category === "folders"
          ? folderRows.map((row, index) =>
              row.type === "folder" ? (
                <button
                  className="track-row category-row"
                  key={row.key}
                  onClick={() => onOpenFolder(row.path)}
                  type="button"
                >
                  <span className="track-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="track-title">
                    <strong>{row.label}</strong>
                    <small>{row.detail}</small>
                  </span>
                  <span className="track-album">{row.tracks.length} songs</span>
                  <span className="track-duration">Open</span>
                </button>
              ) : (
                <TrackRow currentTrack={currentTrack} index={index} key={row.key} onSelectTrack={onSelectTrack} track={row.track} />
              )
            )
          : groups.map((group, index) => (
              <button
                className="track-row category-row"
                key={group.key}
                onClick={() => {
                  onSelectTrack(group.tracks[0], group.tracks);
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

function TrackRow({
  currentTrack,
  index,
  track,
  onSelectTrack
}: {
  currentTrack: Track | null;
  index: number;
  track: Track;
  onSelectTrack: (track: Track, queueTracks?: Track[]) => void;
}) {
  return (
    <button
      className={`track-row ${currentTrack?.id === track.id ? "active" : ""}`}
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
  );
}

function buildGroups(tracks: Track[], category: Exclude<LibraryCategory, "songs" | "folders">) {
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

function getGroupLabel(track: Track, category: Exclude<LibraryCategory, "songs" | "folders">) {
  if (category === "albums") {
    return track.album;
  }
  return track.artist;
}

function getGroupDetail(tracks: Track[], category: Exclude<LibraryCategory, "songs" | "folders">) {
  if (category === "albums") {
    return unique(tracks.map((track) => track.artist)).join(", ");
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
