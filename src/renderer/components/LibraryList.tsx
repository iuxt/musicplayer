import { ChevronLeft, Disc3, Folder, Search, UserRound } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import type { Track } from "../../shared/types";
import { buildFolderBrowserRows } from "../folderBrowser";
import type { LibraryCategory } from "../libraryCategories";
import { ArtworkImage } from "./ArtworkImage";
import { VirtualizedList } from "./VirtualizedList";

interface LibraryListProps {
  category: LibraryCategory;
  tracks: Track[];
  currentTrack: Track | null;
  contextMenuTrackId?: string | null;
  search: string;
  selectedFolderPath: string | null;
  onSearchChange: (value: string) => void;
  onSelectTrack: (track: Track, queueTracks?: Track[]) => void;
  onOpenFolder: (folderPath: string) => void;
  onBackToFolders: () => void;
  onTrackContextMenu: (track: Track, position: { x: number; y: number }) => void;
}

const headings: Record<LibraryCategory, string> = {
  songs: "歌曲",
  albums: "专辑",
  artists: "歌手",
  folders: "文件夹"
};
const artworkUrlCache = new Map<string, Promise<string | null>>();

export const LibraryList = memo(function LibraryList({
  category,
  tracks,
  currentTrack,
  contextMenuTrackId = null,
  search,
  selectedFolderPath,
  onSearchChange,
  onSelectTrack,
  onOpenFolder,
  onBackToFolders,
  onTrackContextMenu
}: LibraryListProps) {
  const isFolderDetail = category === "folders" && Boolean(selectedFolderPath);
  const query = search.trim().toLowerCase();
  const groups = useMemo(
    () =>
      category !== "songs" && category !== "folders"
        ? filterGroups(buildGroups(tracks, category), query)
        : [],
    [category, query, tracks]
  );
  const folderRows = useMemo(
    () => (category === "folders" ? buildFolderBrowserRows(tracks, selectedFolderPath) : []),
    [category, selectedFolderPath, tracks]
  );
  const heading = isFolderDetail ? selectedFolderPath : headings[category];

  return (
    <section className="library-panel" aria-label="音乐库浏览器">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">音乐库</p>
          <h2>{heading}</h2>
        </div>
        <label className="search-box">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="搜索歌曲、歌手、专辑"
          />
        </label>
      </div>

      {isFolderDetail ? (
        <button className="back-button" onClick={onBackToFolders} type="button">
          <ChevronLeft size={16} />
          文件夹
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
              contextMenuTrackId={contextMenuTrackId}
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
                <CategoryIconThumbnail type="folder" />
                <span className="track-title">
                  <strong>{row.label}</strong>
                  <small>{row.detail}</small>
                </span>
                <span className="track-album">{row.tracks.length} 首歌曲</span>
                <span className="track-duration">打开</span>
              </button>
            ) : (
              <TrackRow
                currentTrack={currentTrack}
                contextMenuTrackId={contextMenuTrackId}
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
            <GroupRow category={category} group={group} index={index} onSelectTrack={onSelectTrack} />
          )}
        />
      )}
    </section>
  );
});

function TrackRow({
  currentTrack,
  contextMenuTrackId,
  index,
  track,
  onSelectTrack,
  onTrackContextMenu
}: {
  currentTrack: Track | null;
  contextMenuTrackId: string | null;
  index: number;
  track: Track;
  onSelectTrack: (track: Track, queueTracks?: Track[]) => void;
  onTrackContextMenu: (track: Track, position: { x: number; y: number }) => void;
}) {
  const isActive = currentTrack?.id === track.id;
  const isContextMenuTarget = contextMenuTrackId === track.id;

  return (
    <button
      className={["track-row", "song-row", isActive ? "active" : "", isContextMenuTarget ? "context-menu-target" : ""]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onSelectTrack(track)}
      onContextMenu={(event) => {
        event.preventDefault();
        onTrackContextMenu(track, { x: event.clientX, y: event.clientY });
      }}
      type="button"
    >
      <span className="track-index">{String(index + 1).padStart(2, "0")}</span>
      <ArtworkThumbnail alt={`${track.album} 封面`} artworkPath={track.artworkPath} />
      <span className="track-title">
        <strong>{track.title}</strong>
        <small>{track.artist}</small>
      </span>
      <span className="track-album">{track.album}</span>
      <span className="track-duration">{formatDuration(track.duration)}</span>
    </button>
  );
}

function GroupRow({
  category,
  group,
  index,
  onSelectTrack
}: {
  category: Exclude<LibraryCategory, "songs" | "folders">;
  group: { key: string; label: string; detail: string; tracks: Track[] };
  index: number;
  onSelectTrack: (track: Track, queueTracks?: Track[]) => void;
}) {
  const isAlbum = category === "albums";
  const artworkPath = isAlbum ? group.tracks.find((track) => track.artworkPath)?.artworkPath ?? null : null;

  return (
    <button
      className={`track-row category-row ${isAlbum ? "album-row" : ""}`}
      onClick={() => {
        onSelectTrack(group.tracks[0], group.tracks);
      }}
      type="button"
    >
      <span className="track-index">{String(index + 1).padStart(2, "0")}</span>
      {isAlbum ? (
        <ArtworkThumbnail alt={`${group.label} 封面`} artworkPath={artworkPath} />
      ) : (
        <CategoryIconThumbnail type="artist" />
      )}
      <span className="track-title">
        <strong>{group.label}</strong>
        <small>{group.detail}</small>
      </span>
      <span className="track-album">{group.tracks.length} 首歌曲</span>
      <span className="track-duration">播放</span>
    </button>
  );
}

function ArtworkThumbnail({ alt, artworkPath }: { alt: string; artworkPath: string | null }) {
  const artworkUrl = useArtworkUrl(artworkPath);

  return (
    <span className="track-artwork">
      <ArtworkImage artworkUrl={artworkUrl} alt={alt} iconSize={18} />
    </span>
  );
}

function CategoryIconThumbnail({ type }: { type: "artist" | "folder" }) {
  const Icon = type === "artist" ? UserRound : Folder;
  const label = type === "artist" ? "歌手" : "文件夹";

  return (
    <span className="track-artwork category-icon-thumbnail" role="img" aria-label={label}>
      <Icon size={18} aria-hidden="true" />
    </span>
  );
}

function useArtworkUrl(artworkPath: string | null) {
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setArtworkUrl(null);

    if (!artworkPath) {
      return () => {
        cancelled = true;
      };
    }

    void getCachedArtworkUrl(artworkPath)
      .then((url) => {
        if (!cancelled) {
          setArtworkUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setArtworkUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [artworkPath]);

  return artworkUrl;
}

function getCachedArtworkUrl(artworkPath: string) {
  const cached = artworkUrlCache.get(artworkPath);
  if (cached) {
    return cached;
  }

  const pending = window.musicApi.getArtworkUrl(artworkPath).catch(() => null);
  artworkUrlCache.set(artworkPath, pending);
  return pending;
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

function filterGroups(
  groups: Array<{ key: string; label: string; detail: string; tracks: Track[] }>,
  query: string
) {
  if (!query) {
    return groups;
  }

  return groups.filter((group) =>
    [group.label, group.detail].some((value) => value.toLowerCase().includes(query))
  );
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
