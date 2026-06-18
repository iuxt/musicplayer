# Playback Position Restore Design

## Goal

When the app opens, it should return to the last played track and playback position, but it must stay paused. This lets the user resume manually from the same place without unexpected audio.

## Recommended Approach

Persist a compact playback snapshot in renderer `localStorage`, alongside the existing remembered folder and library cache. The snapshot should include the current track id, current playback time, queued track ids, whether the queue was explicit, and the playlist label. `App.tsx` can restore this after the library has been loaded from cache or a startup rescan.

This keeps the storage model consistent with the existing startup cache and avoids adding a main-process persistence layer.

## Behavior

- Save playback state when the current track changes, playback time changes, the user seeks, or the playlist changes.
- Restore the last current track and position after the remembered library is loaded.
- Do not autoplay on startup, even if the user was playing when the app closed.
- If the saved track no longer exists in the loaded library, ignore the playback snapshot and fall back to the normal first-track behavior.
- If the saved queue contains missing tracks, keep only tracks that still exist.
- Clamp saved time to a valid non-negative number and avoid restoring past the known track duration.
- Continue using existing library cache behavior unchanged.

## Architecture

`App.tsx` remains the owner of library, queue, and persistence orchestration. It will read and validate a `musicplayer:playback-state` value after loading a `ScanResult`, then apply restored queue metadata before telling the audio hook which track and time to restore.

`useAudioPlayer` remains the playback engine. It should gain a small paused-restore path that loads a playable URL, sets `audio.currentTime` to the requested time when metadata is ready enough to accept it, updates React state, and leaves `isPlaying` false.

The hook should continue treating regular track selection and explicit play as user-driven playback actions.

## Error Handling

Invalid JSON, missing fields, unknown track ids, negative times, or non-finite times are treated as a restore miss. A failed URL lookup during restore should clear the restored track attempt and leave the app usable without starting playback.

## Testing

Use TDD with focused tests:

- App startup restores the saved track and displayed progress without calling `play`.
- App startup ignores a saved track id that is not in the loaded library.
- The audio hook can restore a track at a requested time while remaining paused.
- Existing choose-folder, rescan, queue, and playback mode behavior keeps passing.
