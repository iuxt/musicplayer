# Local Music Player

A polished desktop music player for local libraries, built with Electron, React, and TypeScript.

## Features

- Choose a local music folder with the native folder picker.
- Recursively scan nested folders for `mp3`, `m4a`, `aac`, `wav`, `flac`, and `ogg`.
- Read available metadata and fall back to filename-based titles.
- Display embedded artwork or local sidecar artwork such as `cover.jpg`, `folder.jpg`, and same-name images.
- Display local `.lrc` lyrics matched by track filename.
- Search the scanned library.
- Play, pause, seek, change volume, skip tracks, shuffle, and repeat.
- Apple Music-inspired immersive now-playing interface.

## Development

Install dependencies:

```bash
npm install
```

Run the desktop app:

```bash
npm run dev
```

Run verification:

```bash
npm run typecheck
npm test
npm run build
```

## Usage

1. Start the app with `npm run dev`.
2. Click `Choose Folder`.
3. Pick the root folder that contains your music.
4. Select a track from the library list and use the bottom player controls.

All music files remain local on your computer.
