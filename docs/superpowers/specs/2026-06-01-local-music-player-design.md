# Local Music Player Design

## Goal

Build a polished desktop local music player inspired by Apple Music's clean, immersive listening experience. The app should let the user choose a local music folder, recursively scan all nested folders for audio files, and play the discovered library with a beautiful first screen centered on the current track and album art.

## Platform And Stack

The first version will be a desktop application built with Electron, React, and TypeScript.

Electron is the right fit because the core requirement is local disk access. The main process can open a native folder picker, recursively scan folders, parse audio metadata from file paths, and expose a safe IPC API to the renderer. React and TypeScript will handle the UI and app state with a fast iteration loop and strong typing.

The renderer will use the browser's native `audio` element for playback. The main process will provide safe playable URLs for local files instead of exposing unrestricted filesystem access to the UI.

## User Experience

The default screen uses the selected immersive-cover direction:

- A left sidebar for library navigation and folder actions.
- A large now-playing area with album art, title, artist, album, and subtle background color drawn from the active artwork when feasible.
- A compact queue or track list surface for the scanned library.
- A fixed bottom player with previous, play/pause, next, shuffle, repeat, seek, time, and volume controls.

The visual language should reference Apple Music without copying it directly: soft translucency, crisp spacing, high-quality album art presentation, restrained red accent color, and a calm desktop-app layout.

## Core Features

The first version will include:

- Native folder selection.
- Recursive scan of the selected folder and all child folders.
- Audio file discovery for `mp3`, `m4a`, `aac`, `wav`, `flac`, and `ogg`.
- Metadata extraction for title, artist, album, duration, track number, and embedded cover art where available.
- Fallback metadata derived from filename and folder structure when tags are missing.
- Library list with search.
- Playback with play/pause, previous, next, seek, volume, shuffle, and repeat.
- Queue behavior based on the current filtered library list.
- Empty, scanning, success, and error states.

The first version will not include cloud sync, streaming services, accounts, lyrics, advanced playlist editing, system media keys, menu bar controls, or mobile support.

## Architecture

### Main Process

The Electron main process owns privileged filesystem behavior:

- Show the native folder picker.
- Walk the selected folder recursively.
- Filter supported audio extensions.
- Read audio metadata and cover art.
- Convert local tracks and artwork into renderer-safe URLs.
- Expose a narrow IPC surface through preload.

The recursive scanner should be resilient. It should skip unreadable files, collect recoverable errors, and continue scanning the rest of the library.

### Preload API

The preload script exposes a typed `window.musicApi` object:

- `chooseMusicFolder(): Promise<ScanResult>`
- `rescanLibrary(folderPath: string): Promise<ScanResult>`
- `onScanProgress(callback: (progress: ScanProgress) => void): Unsubscribe`
- `getPlayableUrl(filePath: string): Promise<string>`
- `getArtworkUrl(trackId: string): Promise<string | null>`

The renderer should not call Node APIs directly.

### Renderer

The renderer owns UI state and playback state:

- Library state: scanned tracks, current folder, scan status, scan errors.
- Playback state: current track, queue, current time, duration, volume, shuffle, repeat.
- Derived views: search results, album/artist labels, now-playing metadata.

The audio element remains the playback engine. UI controls update the audio element and respond to audio events such as `timeupdate`, `ended`, `loadedmetadata`, and `error`.

Scan progress events should update the UI during long scans with the current folder, discovered track count, and warning count. The app should remain responsive while scanning.

## Data Model

Each track should have:

- `id`: stable hash or generated identifier from file path.
- `filePath`: absolute local file path, used only through IPC.
- `title`
- `artist`
- `album`
- `duration`
- `trackNumber`
- `extension`
- `artworkId`
- `folderPath`

Missing title should fall back to the filename without extension. Missing artist or album should display `Unknown Artist` or `Unknown Album`.

## Error Handling

Scanning should show progress and never fail the whole library because of one bad file. Unreadable files, unsupported files, and metadata parsing errors should be recorded as non-blocking warnings.

Playback errors should mark the current track as failed, show a small inline message, and allow the user to skip to the next track.

If no supported files are found, the app should show a friendly empty state with a clear button to choose another folder.

## Testing And Verification

Verification should cover:

- Recursive scanner finds audio files in nested folders.
- Unsupported extensions are ignored.
- Metadata fallback works when tags are missing.
- Renderer can request playable URLs only through the preload API.
- Playback controls update state correctly.
- UI renders empty, scanning, loaded, and playback-error states.

The implementation should include focused unit tests for scanner and queue logic where practical, plus manual verification in the running Electron app.
