# Library Startup Cache Design

## Goal

Avoid scanning the remembered music folder every time the app starts. Startup should show the last scanned library from cache, and scanning should happen only when it is explicitly needed.

## Confirmed Behavior

- Choosing a new folder scans the folder and stores both the remembered folder path and the scan result cache.
- Using the Library > Rescan Library menu item forces a fresh scan and replaces the cache.
- Starting the app with a remembered folder and a valid matching cache loads tracks from cache without calling `rescanLibrary`.
- Starting the app with a remembered folder but no valid cache falls back to one scan and stores the fresh result.
- A corrupt or mismatched cache is ignored instead of blocking the app.

## Architecture

The renderer already persists the last selected folder in `localStorage`, so the scan result cache should live beside it in `localStorage`. This keeps the main-process scanner unchanged and preserves the existing IPC contract.

`App.tsx` owns startup library state. It will gain small cache helpers that validate a cached `ScanResult` enough to avoid crashing on malformed storage. The existing choose-folder and rescan flows will call a shared library-loading helper so cache writes stay consistent.

## Error Handling

Invalid JSON, missing fields, non-array tracks, or a cache whose `folderPath` does not match the remembered folder are treated as cache misses. Cache misses trigger the existing startup rescan fallback.

## Testing

`src/renderer/App.test.tsx` will cover:

- startup loads cached tracks without calling `rescanLibrary`;
- startup still rescans when only the remembered folder exists;
- explicit rescan updates the stored cache.
