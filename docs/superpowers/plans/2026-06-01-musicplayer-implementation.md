# musicplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished Electron desktop music player that recursively scans a selected local folder and plays the discovered audio library.

**Architecture:** Electron owns local filesystem access, metadata parsing, and secure IPC. React owns the Apple Music-inspired UI and playback state. Shared TypeScript types keep the main, preload, renderer, and tests aligned.

**Tech Stack:** Electron, Vite, React, TypeScript, Vitest, Testing Library, music-metadata, lucide-react.

---

## File Structure

- `package.json`: scripts and dependencies.
- `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`: build and test setup.
- `electron/main.ts`: Electron app lifecycle, window creation, IPC handlers.
- `electron/preload.ts`: typed safe bridge exposed as `window.musicApi`.
- `src/shared/types.ts`: track, scan, progress, and playback type definitions.
- `src/main/scanner.ts`: recursive audio file discovery and metadata normalization.
- `src/main/fileUrls.ts`: conversion from local file paths and artwork buffers to safe URLs.
- `src/main/scanner.test.ts`: scanner unit tests with temporary fixture folders.
- `src/renderer/main.tsx`: React entrypoint.
- `src/renderer/App.tsx`: app shell and state wiring.
- `src/renderer/hooks/useAudioPlayer.ts`: playback state machine around an `HTMLAudioElement`.
- `src/renderer/hooks/useAudioPlayer.test.tsx`: queue and playback state tests.
- `src/renderer/components/*.tsx`: sidebar, now-playing panel, library list, player bar, empty/scanning states.
- `src/renderer/styles.css`: polished Apple Music-inspired desktop styling.
- `src/vite-env.d.ts`: Electron preload API typing for the renderer.

## Task 1: Scaffold Electron React App

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/styles.css`
- Create: `src/vite-env.d.ts`

- [ ] **Step 1: Create project configuration**

Add scripts for `dev`, `build`, `test`, and `typecheck`. Dependencies must include Electron, React, Vite, TypeScript, Vitest, Testing Library, `music-metadata`, and `lucide-react`.

- [ ] **Step 2: Add minimal Electron entrypoints**

Create a main process that opens a browser window with preload enabled, and a preload script that exposes the final `window.musicApi` method names. Each method should return a rejected promise with a clear "musicApi is not wired yet" message until the IPC task replaces it.

- [ ] **Step 3: Add minimal React entrypoint**

Render an app shell with the product name and a disabled folder selection button. Import `styles.css`.

- [ ] **Step 4: Verify scaffold**

Run: `npm install`

Run: `npm run typecheck`

Expected: TypeScript completes with no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts index.html electron src
git commit -m "chore: scaffold Electron React music player"
```

## Task 2: Scanner Types And Recursive Discovery

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/main/scanner.ts`
- Create: `src/main/scanner.test.ts`

- [ ] **Step 1: Write failing scanner test**

Test that `scanMusicFolder(root)` finds supported audio files in nested folders, ignores unsupported files, and returns filename fallbacks before metadata parsing is available.

```ts
expect(result.tracks.map((track) => track.title).sort()).toEqual(["first", "nested"]);
expect(result.warnings).toEqual([]);
```

- [ ] **Step 2: Run scanner test and verify RED**

Run: `npm test -- src/main/scanner.test.ts`

Expected: FAIL because `scanMusicFolder` is not implemented.

- [ ] **Step 3: Implement scanner**

Implement a recursive `fs.promises.readdir(..., { withFileTypes: true })` walk. Support `.mp3`, `.m4a`, `.aac`, `.wav`, `.flac`, and `.ogg`. Use `music-metadata` for duration, title, artist, album, track number, and artwork; fallback to filename, `Unknown Artist`, and `Unknown Album`.

- [ ] **Step 4: Run scanner test and verify GREEN**

Run: `npm test -- src/main/scanner.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/main/scanner.ts src/main/scanner.test.ts
git commit -m "feat: scan local music folders"
```

## Task 3: IPC And File URL Bridge

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Create: `src/main/fileUrls.ts`
- Modify: `src/vite-env.d.ts`

- [ ] **Step 1: Write failing IPC-facing tests where practical**

Add unit tests for `toMediaFileUrl(filePath)` to encode local paths as file URLs and reject empty paths.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/main/fileUrls.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement file URL helper and IPC handlers**

Add `dialog.showOpenDialog` for folder selection, call `scanMusicFolder`, emit `scan-progress`, and expose `chooseMusicFolder`, `rescanLibrary`, `getPlayableUrl`, and `onScanProgress` through preload.

- [ ] **Step 4: Verify GREEN and typecheck**

Run: `npm test -- src/main/fileUrls.test.ts`

Run: `npm run typecheck`

Expected: PASS and no type errors.

- [ ] **Step 5: Commit**

```bash
git add electron src/main/fileUrls.ts src/main/fileUrls.test.ts src/vite-env.d.ts
git commit -m "feat: connect local library IPC"
```

## Task 4: Playback State Hook

**Files:**
- Create: `src/renderer/hooks/useAudioPlayer.ts`
- Create: `src/renderer/hooks/useAudioPlayer.test.tsx`

- [ ] **Step 1: Write failing playback tests**

Test queue selection, next-track behavior, previous-track behavior, shuffle toggle, repeat toggle, and ended behavior.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/renderer/hooks/useAudioPlayer.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement playback hook**

Wrap one `HTMLAudioElement`, keep current track, current time, duration, volume, playing state, shuffle, repeat, and playback error. Request playable URLs through `window.musicApi.getPlayableUrl`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/renderer/hooks/useAudioPlayer.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks
git commit -m "feat: add audio playback state"
```

## Task 5: Apple Music-Inspired UI

**Files:**
- Modify: `src/renderer/App.tsx`
- Create: `src/renderer/components/Sidebar.tsx`
- Create: `src/renderer/components/NowPlaying.tsx`
- Create: `src/renderer/components/LibraryList.tsx`
- Create: `src/renderer/components/PlayerBar.tsx`
- Create: `src/renderer/components/EmptyState.tsx`
- Create: `src/renderer/components/ScanningState.tsx`
- Modify: `src/renderer/styles.css`

- [ ] **Step 1: Add UI components**

Build the immersive-cover layout: sidebar, large cover panel, searchable library list, scanning/empty/error states, and bottom transport controls.

- [ ] **Step 2: Wire scanner to UI**

The folder button calls `window.musicApi.chooseMusicFolder()`, stores tracks and warnings, subscribes to progress, and sets the first track as the initial now-playing candidate.

- [ ] **Step 3: Wire player controls**

Connect play/pause, previous, next, seek, volume, shuffle, repeat, track click, and playback-error state to `useAudioPlayer`.

- [ ] **Step 4: Verify in browser/Electron**

Run: `npm run typecheck`

Run: `npm test`

Run: `npm run dev`

Expected: app opens, empty state renders, folder picker works, nested tracks appear, and playback controls are visible.

- [ ] **Step 5: Commit**

```bash
git add src/renderer
git commit -m "feat: build immersive player interface"
```

## Task 6: Final Verification And Polish

**Files:**
- Modify as needed based on verification.
- Update: `README.md`

- [ ] **Step 1: Add README**

Document install, dev, test, and how to choose a folder.

- [ ] **Step 2: Run full verification**

Run: `npm run typecheck`

Run: `npm test`

Run: `npm run build`

Expected: all pass.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, choose a folder containing nested audio files, play one track, seek, change volume, next/previous, search, and rescan.

- [ ] **Step 4: Commit**

```bash
git add README.md .
git commit -m "docs: add usage instructions"
```

## Self-Review

- Spec coverage: folder selection, recursive scanning, metadata fallbacks, supported extensions, immersive UI, playback controls, queue behavior, scanning/error states, and verification are covered.
- Red-flag scan: no incomplete task markers remain; each task names concrete files, commands, and expected outcomes.
- Type consistency: shared terms are `Track`, `ScanResult`, `ScanProgress`, `musicApi`, `chooseMusicFolder`, `rescanLibrary`, `getPlayableUrl`, and `onScanProgress` throughout.
