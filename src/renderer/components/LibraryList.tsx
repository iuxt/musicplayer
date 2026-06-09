import { ChevronLeft, Search } from "lucide-react";
import { memo, useMemo } from "react";
import type { Track } from "../../shared/types";
import { buildFolderBrowserRows } from "../folderBrowser";
import type { LibraryCategory } from "../libraryCategories";
import { VirtualizedList } from "./VirtualizedList";

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
  onTrackContextMenu: (track: Track, position: { x: number; y: number }) => void;
}

const headings: Record<LibraryCategory, string> = {
  songs: "Songs",
  albums: "Albums",
  artists: "Artists",
  folders: "Folders"
};

export const LibraryList = memo(function LibraryList({
  category,
  tracks,
  currentTrack,
  search,
  selectedFolderPath,
  onSearchChange,
  onSelectTrack,
  onOpenFolder,
  onBackToFolders,
  onTrackContextMenu
}: LibraryListProps) {
  const isFolderDetail = category === "folders" && Boolean(selectedFolderPath);
  const groups = useMemo(
    () => (category !== "songs" && category !== "folders" ? buildGroups(tracks, category) : []),
    [category, tracks]
  );
  const folderRows = useMemo(
    () => (category === "folders" ? buildFolderBrowserRows(tracks, selectedFolderPath) : []),
    [category, selectedFolderPath, tracks]
  );
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

      {category === "songs" ? (
        <VirtualizedList
          className="track-list"
          estimatedRowHeight={62}
          items={tracks}
          getKey={(track) => track.id}
          renderItem={(track, index) => (
            <TrackRow
              currentTrack={currentTrack}
              index={index}
              onSelectTrack={onSelectTrack}
              onTrackContextMenu={onTrackContextMenu}
              track={track}
            />
          )}
        />
      ) : category === "folders" ? (
        <VirtualizedList
          className="track-list"
          estimatedRowHeight={62}
          items={folderRows}
          getKey={(row) => row.key}
          renderItem={(row, index) =>
            row.type === "folder" ? (
              <button className="track-row category-row" onClick={() => onOpenFolder(row.path)} type="button">
                <span className="track-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="track-title">
                  <strong>{row.label}</strong>
                  <small>{row.detail}</small>
                </span>
                <span className="track-album">{row.tracks.length} songs</span>
                <span className="track-duration">Open</span>
              </button>
            ) : (
              <TrackRow
                currentTrack={currentTrack}
                index={index}
                onSelectTrack={onSelectTrack}
                onTrackContextMenu={onTrackContextMenu}
                track={row.track}
              />
            )
          }
        />
      ) : (
        <VirtualizedList
          className="track-list"
          estimatedRowHeight={62}
          items={groups}
          getKey={(group) => group.key}
          renderItem={(group, index) => (
            <button
              className="track-row category-row"
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
          )}
        />
      )}
    </section>
  );
});

function TrackRow({
  currentTrack,
  index,
  track,
  onSelectTrack,
  onTrackContextMenu
}: {
  currentTrack: Track | null;
  index: number;
  track: Track;
  onSelectTrack: (track: Track, queueTracks?: Track[]) => void;
  onTrackContextMenu: (track: Track, position: { x: number; y: number }) => void;
}) {
  return (
    <button
      className={`track-row ${currentTrack?.id === track.id ? "active" : ""}`}
      onClick={() => onSelectTrack(track)}
      onContextMenu={(event) => {
        event.preventDefault();
        onTrackContextMenu(track, { x: event.clientX, y: event.clientY });
      }}
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
