# Library Category Row Icons Design

## Goal

Fill the empty thumbnail column for artist and folder category rows in the library list. Artist rows should show an artist/person-style icon, and folder rows should show a folder icon.

## Scope

In scope:

- Add an icon in the existing row thumbnail position for artist group rows.
- Add an icon in the existing row thumbnail position for folder rows.
- Keep song rows using track artwork.
- Keep album rows using album artwork or the current album fallback icon.
- Preserve existing row height, click behavior, grouping behavior, sorting, and playback behavior.

Out of scope:

- Changing sidebar icons.
- Generating artist images or folder artwork.
- Adding new metadata, cache fields, or filesystem scanning behavior.
- Changing playlist rows or player bar artwork.

## Architecture

The change stays inside the renderer list presentation layer. `LibraryList.tsx` already owns the row rendering for songs, albums, artists, and folders. It should add a small reusable icon thumbnail renderer for non-artwork category rows.

Recommended shape:

```tsx
function CategoryIconThumbnail({ type }: { type: "artist" | "folder" }) {
  const Icon = type === "artist" ? UserRound : Folder;
  return (
    <span className="track-artwork category-icon-thumbnail" aria-label={type === "artist" ? "歌手" : "文件夹"}>
      <Icon size={18} aria-hidden="true" />
    </span>
  );
}
```

This uses the existing `track-artwork` dimensions so the new icons align with song artwork and album artwork in the same column.

## Components

### Folder Rows

Folder rows currently render an index followed directly by title/detail text. They should insert the folder icon thumbnail between the index and the title. The row should use the same five-column grid as song and album rows.

### Artist Rows

`GroupRow` should render:

- Album artwork for album groups, unchanged.
- An artist icon thumbnail for artist groups.

The artist row click still starts playback from the first track in that artist group and passes the grouped tracks as the queue.

## Styling

Reuse `.track-artwork` for stable dimensions, alignment, radius, and fallback visual weight. Add a narrow modifier only if needed for the category icon color or background.

The icon should be decorative within an already labeled row, but it should still have an accessible label on the thumbnail element so tests can locate the intended category icon without depending on SVG internals.

No new layout shift should occur. Artist and folder category rows should use the same grid template as `.song-row` and `.album-row`.

## Error Handling

There is no new async work and no new error surface. Missing artist names, folder labels, or grouped tracks continue to follow the current grouping and row-rendering behavior.

## Testing

Add focused renderer tests for:

- Artist category rows render an artist/person icon thumbnail in the artwork column.
- Folder rows render a folder icon thumbnail in the artwork column.
- Existing album artwork behavior continues to render album art when present.

Existing tests for virtualization, track row playback, album grouping, artist queue playback, and folder drill-down should continue to pass.
