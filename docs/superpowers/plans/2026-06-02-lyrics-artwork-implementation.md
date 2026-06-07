# Lyrics And Artwork Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display real album artwork and local lyrics for scanned tracks.

**Architecture:** The main process discovers local sidecar artwork and lyrics during scanning and stores paths on each track. IPC converts local artwork files to safe file URLs and reads lyrics text on demand. The renderer requests those assets for the current track and displays them in the now-playing surface.

**Tech Stack:** Electron, React, TypeScript, Vitest, Node fs/path APIs.

---

### Task 1: Scanner Metadata

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/scanner.ts`
- Modify: `src/main/scanner.test.ts`

- [ ] Write a failing scanner test that creates `song.flac`, `song.lrc`, and `cover.jpg`, then expects the scanned track to include `lyricsPath`, `hasLyrics`, and `artworkPath`.
- [ ] Run `npm test -- src/main/scanner.test.ts` and verify the new test fails.
- [ ] Add `artworkPath`, `lyricsPath`, and `hasLyrics` to `Track`.
- [ ] Implement sidecar discovery for same-basename `.lrc`, title-matched `.lrc`, `cover/folder/front` images, and same-basename images.
- [ ] Run `npm test -- src/main/scanner.test.ts` and verify it passes.

### Task 2: IPC Accessors

**Files:**
- Modify: `src/main/fileUrls.ts`
- Modify: `src/main/fileUrls.test.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.cts`
- Modify: `src/vite-env.d.ts`

- [ ] Write failing tests for `toOptionalFileUrl(null)` and `readLyricsFile(path)`.
- [ ] Run `npm test -- src/main/fileUrls.test.ts` and verify the new tests fail.
- [ ] Implement optional file URL and lyrics file reading helpers.
- [ ] Add `getLyrics(filePath)` IPC and expose it through preload.
- [ ] Run `npm test -- src/main/fileUrls.test.ts` and `npm run typecheck`.

### Task 3: Renderer UI

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/NowPlaying.tsx`
- Modify: `src/renderer/styles.css`

- [ ] Load current track artwork URL and lyrics text in React effects.
- [ ] Render real artwork when available and a styled fallback otherwise.
- [ ] Render a lyrics panel next to the now-playing area, with empty and loading states.
- [ ] Run `npm run typecheck`, `npm test`, and `npm run build`.

### Task 4: Install

**Files:**
- Update as needed based on verification.

- [ ] Run `npm run build:mac`.
- [ ] Launch `/Applications/Local Music Player.app` and verify the app renders.
- [ ] Commit the completed change.

## Self-Review

- Covers local lyrics and artwork display.
- Keeps lookup local-only and avoids network fetching.
- Uses focused tests for scanner and file access behavior.
