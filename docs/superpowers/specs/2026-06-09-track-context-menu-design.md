# Track Context Menu Design

## Goal

Add a right-click context menu for individual songs in the library. The menu lets the user open a track in the system file manager, edit saved audio metadata, trash the current lyric file, or trash the current audio file together with same-name sidecar files.

## Scope

The menu applies only to concrete track rows in the library browser, including the main Songs view and song rows inside folder detail views. Album, artist, and folder grouping rows do not expose file-level actions.

The actions are:

- Open file location.
- Edit music information.
- Delete current lyrics.
- Delete current music file, including same-name lyrics and same-name cover art.

Deleting files always moves them to the system trash. The app does not permanently delete files.

## Architecture

The renderer owns menu presentation and app state updates. `LibraryList` reports right-clicks on track rows to `App.tsx`, which coordinates menu state, edit modal state, async actions, error messages, library updates, queue updates, and cache persistence.

The Electron main process owns all filesystem and OS operations. New preload methods expose a narrow API:

- `showTrackInFolder(filePath)`.
- `updateTrackMetadata(filePath, metadata)`.
- `trashTrackLyrics(track)`.
- `trashTrackFiles(track)`.

The renderer never receives generic filesystem write access. Each IPC handler accepts only the fields needed for its operation and returns structured success or failure data.

## Context Menu

Right-clicking a track row opens a custom React context menu at the pointer position. The menu clamps to the visible window so it does not render off-screen. It closes when the user clicks outside it, presses `Escape`, scrolls the list, or selects an item.

Menu items use icon-plus-text buttons consistent with the existing lucide icon usage. Destructive actions use the app's red danger styling.

The lyric delete item is disabled when `track.hasLyrics` is false or `track.lyricsPath` is null. Async actions disable repeated activation while the action is running. Failures are shown through the existing app-level error area.

## Edit Music Information

Choosing "Edit music information" opens a modal dialog. The dialog edits:

- Title.
- Artist.
- Album.
- Track number.

Title, artist, and album are trimmed before saving. Track number can be empty or a positive integer. Invalid values keep the dialog open and show inline validation.

Saving calls a main-process metadata writer. The writer updates tags in the audio file and returns either an updated `Track` or a structured error. On success, the renderer replaces the matching track in `tracks` and `playQueue`, updates the current playing track if needed, refreshes cached library data, and lets existing derived views recompute sorting, search results, album groups, artist groups, and folder rows.

If writing succeeds but reparsing the audio file fails, the app still updates visible title, artist, album, and track number from the submitted values while preserving file path, duration, lyrics, artwork, and folder data. If writing fails, the UI keeps the original track data and shows the error.

## Delete Lyrics

Deleting lyrics moves only `track.lyricsPath` to the system trash. If the file no longer exists, the operation is treated as successful so stale cache data can be repaired.

On success, the renderer updates the matching track so `lyricsPath` becomes `null` and `hasLyrics` becomes `false`. If the affected track is currently playing, already loaded lyrics are cleared and the fullscreen lyrics view falls back to the no-lyrics state.

## Delete Music File

Deleting the current music file asks for confirmation before any filesystem action. The confirmation states that files will be moved to the system trash and summarizes that the app will include the audio file, same-name lyrics, and same-name cover art.

The main process computes deletion candidates from the selected track:

- The audio file at `track.filePath`.
- Same-basename `.lrc` in the audio file's directory.
- Same-basename `.jpg`, `.jpeg`, `.png`, or `.webp` in the audio file's directory.

Shared album artwork names such as `cover.*`, `folder.*`, and `front.*` are not removed unless they also have the exact same basename as the audio file. This avoids deleting cover art used by other tracks in the same folder.

Each candidate is moved to the system trash. The main process returns which candidates succeeded and which failed. The renderer removes the track from the library only when the audio file was successfully trashed or was already missing.

After a successful audio deletion, the renderer removes the track from `tracks`, `playQueue`, library cache, and playback restore cache. If the deleted track is currently loaded, playback stops and the app attempts to move to the next remaining queue track. If there is no next track, the current playback state is cleared.

If only sidecar files fail, the track is still removed and the error lists the sidecar files that could not be trashed. If the audio file fails, the track remains in the library and the error explains that the music file was not removed.

## Error Handling

Filesystem and metadata failures return structured errors instead of throwing untyped values across the preload boundary. The renderer maps these into concise user-facing messages.

Expected non-fatal conditions:

- Lyrics or sidecar file already missing.
- Artwork file not present.
- Metadata write unsupported for a specific audio format.
- OS trash operation rejected by the platform.

Only successful operations update cached state. Failed write or failed audio deletion keeps the existing library entry intact.

## Testing

Renderer tests cover:

- Right-clicking a song row opens the menu.
- Album, artist, and folder grouping rows do not expose file actions.
- The delete-lyrics item is disabled for tracks without lyrics.
- Opening and cancelling the edit dialog preserves track data.
- Saving metadata updates the song row and current playback display.
- Deleting lyrics clears `lyricsPath` and `hasLyrics`.
- Deleting a track removes it from the library and playlist without removing unrelated tracks.

Main and preload tests cover:

- Preload exposes only the expected context-menu APIs.
- Opening file location delegates to Electron shell file reveal behavior.
- Lyrics and track deletion use the system trash path, not permanent deletion.
- Track deletion includes same-basename sidecars and excludes shared `cover`, `folder`, and `front` artwork.
- Metadata write success and failure return structured results.

Integration-level app tests cover current-track behavior after deletion, cache updates, and visible error messages for failed filesystem operations.
