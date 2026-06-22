# Track Delete Confirmation and Playback Stop Design

## Goal

Improve the library track delete flow so the confirmation dialog names the exact music file being moved to the system trash, and deleting the currently loaded song stops playback before any filesystem deletion is attempted.

## Scope

This is a focused update to the existing track context menu delete behavior.

- The delete confirmation dialog shows the selected track's disk filename, derived from `track.filePath`.
- The track context menu delete label becomes clearer about moving the music file to the trash.
- If the selected track is the current audio player's loaded track, the renderer stops playback and releases the audio source before calling `window.musicApi.trashTrackFiles(track)`.
- The existing filesystem behavior stays the same: the main process moves the audio file, same-basename lyrics, and same-basename artwork to the system trash.

This does not add permanent deletion, batch deletion, undo, or a separate custom modal.

## Current Context

`TrackContextMenu.tsx` renders the right-click menu and currently labels the destructive action as "删除当前音乐文件". `App.tsx` owns the delete flow in `deleteTrackFiles(track)`, which asks for confirmation and then calls `window.musicApi.trashTrackFiles(track)`. After a successful audio deletion, `removeTrackFromLibrary(track)` removes the track from library state, playlist state, and playback restore state.

The current confirmation text describes the affected file types but does not include the concrete filename. Current playback is only stopped after the trash operation succeeds and only inside the library removal path.

## Design

The renderer will keep owning the interaction. No preload or main process API changes are needed.

`deleteTrackFiles(track)` will derive a display filename from `track.filePath` using path-separator tolerant logic in the renderer. The confirmation text will be:

```text
将把音乐文件“song.flac”以及同名歌词、同名封面移到废纸篓。是否继续？
```

The filename will be the basename of the path. If basename extraction fails because the path is empty or malformed, the dialog will fall back to the full `track.filePath` string; scanned tracks should normally always have a valid file path.

The context menu destructive item will use clearer wording:

```text
移到废纸篓
```

The action still applies to the selected music file and its same-basename sidecars, matching the existing confirmation text and filesystem behavior.

## Deleting the Current Track

If `player.currentTrack?.id === track.id`, the renderer will stop playback immediately after the user confirms deletion and before calling `window.musicApi.trashTrackFiles(track)`. Calling `player.stop()` is preferred over pause because it removes the audio `src`, clears current playback state, and releases the browser audio element's reference to the local file.

When the audio deletion succeeds, the renderer removes the track from `tracks`, `playQueue`, library cache, and playback restore cache. Because the delete flow already stopped playback before the filesystem call, it will not automatically select or play the next remaining track after deleting the current track.

When a non-current track is deleted, existing behavior stays intact: the track is removed from library and playlist state if the audio file was trashed or was already missing.

If the trash operation fails after stopping the current track, the track remains in the library and the app shows the existing error message. Playback remains stopped so the app does not immediately re-open a file the user tried to delete.

## Error Handling

The confirmation is still cancelable. Canceling closes the context menu and performs no state change.

The main process remains the source of truth for whether the audio file was removed. The renderer only removes a track from the library when `result.audioRemoved` is true. Partial sidecar failures continue to surface through `result.error` while still removing the track if the audio file was removed.

## Testing

Renderer tests will cover:

- The delete confirmation dialog includes the selected track's disk filename, not only generic text.
- Confirming deletion of the currently playing track calls playback stop behavior before `window.musicApi.trashTrackFiles(track)`.
- Deleting the currently playing track does not auto-play the next queue item after the delete succeeds.
- Existing track deletion behavior still removes the trashed track from the library and playlist.

The existing main-process trash candidate tests remain valid because candidate selection and OS trash behavior do not change.
