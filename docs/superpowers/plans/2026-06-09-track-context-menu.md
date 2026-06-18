# Track Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-click song context menu that can reveal a file, edit audio metadata on disk, trash lyrics, and trash the selected music file plus same-name sidecars.

**Architecture:** React owns the custom context menu, edit dialog, and library state updates. Electron preload exposes a narrow typed API, and Electron main owns OS/file operations. Metadata writing uses `ffmpeg` stream-copy metadata rewrite via `ffmpeg-static`, with `FFMPEG_PATH` and PATH fallback support.

**Tech Stack:** Electron, React, TypeScript, Vitest, Testing Library, music-metadata, ffmpeg-static, lucide-react.

---

## File Structure

- Modify `package.json` and `package-lock.json`: add `ffmpeg-static`.
- Modify `src/shared/types.ts`: add metadata edit and media action result types shared by preload, main, and renderer.
- Create `src/main/trackFileActions.ts`: compute same-basename sidecar candidates and trash files through an injected trash function.
- Create `src/main/trackFileActions.test.ts`: verify lyric deletion, music deletion candidates, shared-artwork exclusion, and failed audio deletion behavior.
- Create `src/main/metadataWriter.ts`: normalize metadata, run ffmpeg, replace the original file, and read visible metadata after writing.
- Create `src/main/metadataWriter.test.ts`: verify ffmpeg args, validation, success fallback, and structured failures without running a real ffmpeg process.
- Modify `electron/preload.cts`: expose reveal, metadata update, lyrics trash, and track trash APIs.
- Modify `electron/main.ts`: register IPC handlers and call `shell.showItemInFolder`, `shell.trashItem`, and metadata writer functions.
- Modify `src/vite-env.d.ts`: type the new `window.musicApi` methods.
- Create `src/renderer/components/TrackContextMenu.tsx`: render and clamp the custom context menu.
- Create `src/renderer/components/EditTrackMetadataDialog.tsx`: render the metadata edit modal with validation.
- Modify `src/renderer/components/LibraryList.tsx`: report right-clicks only from concrete track rows.
- Modify `src/renderer/hooks/useAudioPlayer.ts`: add `stop()` and `replaceCurrentTrack(track)` helpers for deletion and metadata refresh.
- Modify `src/renderer/App.tsx`: own menu/dialog state and synchronize tracks, queue, cache, playback state, artwork, and lyrics after actions.
- Modify `src/renderer/styles.css`: add menu, modal, validation, and danger styles.
- Modify `src/renderer/App.test.tsx` and component tests: cover menu visibility, disabled lyric action, edit dialog, state sync, deletion, and errors.
- Modify `scripts/electron-preload.test.ts`: verify IPC names and shell/trash integration are present.

---

### Task 1: Shared API Types And Dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/shared/types.ts`
- Modify: `src/vite-env.d.ts`

- [ ] **Step 1: Add the ffmpeg dependency**

Run:

```bash
npm install ffmpeg-static
```

Expected: `package.json` has `ffmpeg-static` under `dependencies`, and `package-lock.json` is updated.

- [ ] **Step 2: Add shared action types**

Add these exports to `src/shared/types.ts` after the existing `ScanResult` interface:

```ts
export interface TrackMetadataUpdate {
  title: string;
  artist: string;
  album: string;
  trackNumber: number | null;
}

export interface TrackMetadataFields extends TrackMetadataUpdate {
  duration: number;
}

export type MediaActionResult =
  | { ok: true }
  | { ok: false; error: string };

export interface TrashFileEntry {
  filePath: string;
  kind: "audio" | "lyrics" | "artwork";
}

export interface TrashTrackFilesResult {
  ok: boolean;
  audioRemoved: boolean;
  trashed: TrashFileEntry[];
  failed: Array<TrashFileEntry & { error: string }>;
  error: string | null;
}

export type UpdateTrackMetadataResult =
  | { ok: true; metadata: TrackMetadataFields }
  | { ok: false; error: string };
```

- [ ] **Step 3: Extend the renderer preload type**

Update the import and `Window.musicApi` shape in `src/vite-env.d.ts`:

```ts
import type {
  MediaActionResult,
  ScanProgress,
  ScanResult,
  Track,
  TrackMetadataUpdate,
  TrashTrackFilesResult,
  UpdateTrackMetadataResult
} from "./shared/types";
```

Add methods inside `musicApi`:

```ts
      showTrackInFolder: (filePath: string) => Promise<MediaActionResult>;
      updateTrackMetadata: (filePath: string, metadata: TrackMetadataUpdate) => Promise<UpdateTrackMetadataResult>;
      trashTrackLyrics: (track: Track) => Promise<MediaActionResult>;
      trashTrackFiles: (track: Track) => Promise<TrashTrackFilesResult>;
```

- [ ] **Step 4: Run the type check**

Run:

```bash
npm run typecheck
```

Expected: it may fail because preload and main do not yet implement the new methods. The expected failure mentions missing `musicApi` properties in test mocks or implementation, not syntax errors in `src/shared/types.ts`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/shared/types.ts src/vite-env.d.ts
git commit -m "feat: add media action contracts"
```

---

### Task 2: Track File Trash Helpers

**Files:**
- Create: `src/main/trackFileActions.ts`
- Create: `src/main/trackFileActions.test.ts`

- [ ] **Step 1: Write failing tests for file candidates and trash results**

Create `src/main/trackFileActions.test.ts`:

```ts
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Track } from "../shared/types.js";
import { buildTrackTrashCandidates, trashTrackFiles, trashTrackLyrics } from "./trackFileActions.js";

describe("track file actions", () => {
  it("trashes current lyrics and treats a missing lyrics path as success", async () => {
    const root = await mkdirTemp("lyrics-trash-");
    const lyricsPath = path.join(root, "song.lrc");
    await writeFile(lyricsPath, "[00:01.00]line", "utf8");
    const trash = vi.fn(async () => undefined);

    await expect(trashTrackLyrics(makeTrack({ lyricsPath }), trash)).resolves.toEqual({ ok: true });
    expect(trash).toHaveBeenCalledWith(lyricsPath);
    await expect(trashTrackLyrics(makeTrack({ lyricsPath: null }), trash)).resolves.toEqual({ ok: true });
  });

  it("includes audio, same-basename lyrics, and same-basename artwork", async () => {
    const root = await mkdirTemp("track-trash-");
    const audioPath = path.join(root, "song.mp3");
    await writeFile(audioPath, "audio");
    await writeFile(path.join(root, "song.lrc"), "lyrics");
    await writeFile(path.join(root, "song.jpg"), "artwork");
    await writeFile(path.join(root, "cover.jpg"), "shared artwork");

    expect(await buildTrackTrashCandidates(makeTrack({ filePath: audioPath }))).toEqual([
      { filePath: audioPath, kind: "audio" },
      { filePath: path.join(root, "song.lrc"), kind: "lyrics" },
      { filePath: path.join(root, "song.jpg"), kind: "artwork" }
    ]);
  });

  it("keeps the track when the audio file cannot be trashed", async () => {
    const root = await mkdirTemp("audio-trash-fail-");
    const audioPath = path.join(root, "song.flac");
    await writeFile(audioPath, "audio");
    const trash = vi.fn(async (filePath: string) => {
      if (filePath === audioPath) {
        throw new Error("trash rejected");
      }
    });

    await expect(trashTrackFiles(makeTrack({ filePath: audioPath }), trash)).resolves.toMatchObject({
      ok: false,
      audioRemoved: false,
      trashed: [],
      failed: [{ filePath: audioPath, kind: "audio", error: "trash rejected" }]
    });
  });
});

async function mkdirTemp(prefix: string) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: "track-id",
    filePath: "/music/song.mp3",
    title: "Song",
    artist: "Artist",
    album: "Album",
    duration: 180,
    trackNumber: null,
    extension: "mp3",
    artworkId: null,
    artworkPath: null,
    lyricsPath: null,
    hasLyrics: false,
    folderPath: "",
    ...overrides
  };
}
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npx vitest run src/main/trackFileActions.test.ts
```

Expected: FAIL because `src/main/trackFileActions.ts` does not exist.

- [ ] **Step 3: Implement the helpers**

Create `src/main/trackFileActions.ts`:

```ts
import { access } from "node:fs/promises";
import path from "node:path";
import type { MediaActionResult, Track, TrashFileEntry, TrashTrackFilesResult } from "../shared/types.js";

const artworkExtensions = ["jpg", "jpeg", "png", "webp"] as const;

export type TrashFile = (filePath: string) => Promise<void>;

export async function trashTrackLyrics(track: Track, trashFile: TrashFile): Promise<MediaActionResult> {
  if (!track.lyricsPath) {
    return { ok: true };
  }

  if (!(await exists(track.lyricsPath))) {
    return { ok: true };
  }

  try {
    await trashFile(track.lyricsPath);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Unable to move lyrics to trash.") };
  }
}

export async function trashTrackFiles(track: Track, trashFile: TrashFile): Promise<TrashTrackFilesResult> {
  const candidates = await buildTrackTrashCandidates(track);
  const trashed: TrashFileEntry[] = [];
  const failed: Array<TrashFileEntry & { error: string }> = [];

  for (const candidate of candidates) {
    try {
      await trashFile(candidate.filePath);
      trashed.push(candidate);
    } catch (error) {
      failed.push({ ...candidate, error: errorMessage(error, "Unable to move file to trash.") });
    }
  }

  const audioCandidate = candidates.find((candidate) => candidate.kind === "audio");
  const audioRemoved =
    !audioCandidate || trashed.some((candidate) => candidate.kind === "audio" && candidate.filePath === audioCandidate.filePath);
  const ok = failed.length === 0 || audioRemoved;

  return {
    ok,
    audioRemoved,
    trashed,
    failed,
    error: failed.length === 0 ? null : summarizeTrashFailures(failed, audioRemoved)
  };
}

export async function buildTrackTrashCandidates(track: Track): Promise<TrashFileEntry[]> {
  const directory = path.dirname(track.filePath);
  const basename = path.basename(track.filePath, path.extname(track.filePath));
  const candidates: TrashFileEntry[] = [{ filePath: track.filePath, kind: "audio" }];

  const lyricsPath = path.join(directory, `${basename}.lrc`);
  if (await exists(lyricsPath)) {
    candidates.push({ filePath: lyricsPath, kind: "lyrics" });
  }

  for (const extension of artworkExtensions) {
    const artworkPath = path.join(directory, `${basename}.${extension}`);
    if (await exists(artworkPath)) {
      candidates.push({ filePath: artworkPath, kind: "artwork" });
    }
  }

  return candidates;
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function summarizeTrashFailures(failed: Array<TrashFileEntry & { error: string }>, audioRemoved: boolean) {
  if (!audioRemoved && failed.some((entry) => entry.kind === "audio")) {
    return "Unable to move the music file to trash.";
  }
  return "The music file was removed, but some related files could not be moved to trash.";
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
npx vitest run src/main/trackFileActions.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/trackFileActions.ts src/main/trackFileActions.test.ts
git commit -m "feat: add track trash helpers"
```

---

### Task 3: Metadata Writer

**Files:**
- Create: `src/main/metadataWriter.ts`
- Create: `src/main/metadataWriter.test.ts`

- [ ] **Step 1: Write failing tests for ffmpeg metadata rewriting**

Create `src/main/metadataWriter.test.ts`:

```ts
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildFfmpegMetadataArgs,
  normalizeTrackMetadataUpdate,
  readTrackMetadataFields,
  writeTrackMetadata
} from "./metadataWriter.js";

describe("metadata writer", () => {
  it("normalizes editable metadata", () => {
    expect(
      normalizeTrackMetadataUpdate({
        title: "  Title  ",
        artist: "  Artist ",
        album: " Album ",
        trackNumber: 3
      })
    ).toEqual({ title: "Title", artist: "Artist", album: "Album", trackNumber: 3 });
  });

  it("rejects invalid metadata", () => {
    expect(() =>
      normalizeTrackMetadataUpdate({ title: "", artist: "Artist", album: "Album", trackNumber: null })
    ).toThrow("Title is required.");
    expect(() =>
      normalizeTrackMetadataUpdate({ title: "Title", artist: "Artist", album: "Album", trackNumber: 0 })
    ).toThrow("Track number must be a positive integer.");
  });

  it("builds ffmpeg stream-copy metadata args", () => {
    expect(
      buildFfmpegMetadataArgs("/music/song.mp3", "/music/.song.tmp.mp3", {
        title: "Title",
        artist: "Artist",
        album: "Album",
        trackNumber: null
      })
    ).toEqual([
      "-y",
      "-i",
      "/music/song.mp3",
      "-map",
      "0",
      "-codec",
      "copy",
      "-metadata",
      "title=Title",
      "-metadata",
      "artist=Artist",
      "-metadata",
      "album=Album",
      "-metadata",
      "track=",
      "/music/.song.tmp.mp3"
    ]);
  });

  it("returns submitted metadata when parse after write cannot read the fake file", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "metadata-write-"));
    const trackPath = path.join(root, "song.mp3");
    await writeFile(trackPath, "not real audio");
    const runner = vi.fn(async (_binary: string, args: string[]) => {
      const outputPath = args[args.length - 1];
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, "rewritten fake audio");
    });

    await expect(
      writeTrackMetadata(trackPath, { title: "Title", artist: "Artist", album: "Album", trackNumber: 7 }, { runner })
    ).resolves.toEqual({
      ok: true,
      metadata: { title: "Title", artist: "Artist", album: "Album", trackNumber: 7, duration: 0 }
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npx vitest run src/main/metadataWriter.test.ts
```

Expected: FAIL because `src/main/metadataWriter.ts` does not exist.

- [ ] **Step 3: Implement metadata writing**

Create `src/main/metadataWriter.ts`:

```ts
import { execFile } from "node:child_process";
import { mkdir, rename, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import type { TrackMetadataFields, TrackMetadataUpdate, UpdateTrackMetadataResult } from "../shared/types.js";

type FfmpegRunner = (binary: string, args: string[]) => Promise<void>;

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

export async function writeTrackMetadata(
  filePath: string,
  metadata: TrackMetadataUpdate,
  options: { runner?: FfmpegRunner; ffmpegPath?: string } = {}
): Promise<UpdateTrackMetadataResult> {
  let normalized: TrackMetadataUpdate;
  try {
    normalized = normalizeTrackMetadataUpdate(metadata);
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Invalid metadata.") };
  }

  const tempPath = temporaryAudioPath(filePath);
  const runner = options.runner ?? runFfmpeg;
  const ffmpegPath = options.ffmpegPath ?? resolveFfmpegPath();

  try {
    await mkdir(path.dirname(tempPath), { recursive: true });
    await runner(ffmpegPath, buildFfmpegMetadataArgs(filePath, tempPath, normalized));
    await rename(tempPath, filePath);
    return { ok: true, metadata: await readTrackMetadataFields(filePath, normalized) };
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    return { ok: false, error: errorMessage(error, "Unable to update music information.") };
  }
}

export function normalizeTrackMetadataUpdate(metadata: TrackMetadataUpdate): TrackMetadataUpdate {
  const normalized = {
    title: metadata.title.trim(),
    artist: metadata.artist.trim(),
    album: metadata.album.trim(),
    trackNumber: metadata.trackNumber
  };

  if (!normalized.title) {
    throw new Error("Title is required.");
  }
  if (!normalized.artist) {
    throw new Error("Artist is required.");
  }
  if (!normalized.album) {
    throw new Error("Album is required.");
  }
  if (
    normalized.trackNumber !== null &&
    (!Number.isInteger(normalized.trackNumber) || normalized.trackNumber <= 0)
  ) {
    throw new Error("Track number must be a positive integer.");
  }

  return normalized;
}

export function buildFfmpegMetadataArgs(inputPath: string, outputPath: string, metadata: TrackMetadataUpdate) {
  return [
    "-y",
    "-i",
    inputPath,
    "-map",
    "0",
    "-codec",
    "copy",
    "-metadata",
    `title=${metadata.title}`,
    "-metadata",
    `artist=${metadata.artist}`,
    "-metadata",
    `album=${metadata.album}`,
    "-metadata",
    `track=${metadata.trackNumber ?? ""}`,
    outputPath
  ];
}

export async function readTrackMetadataFields(
  filePath: string,
  fallback: TrackMetadataUpdate
): Promise<TrackMetadataFields> {
  try {
    const metadataModule = (await import("music-metadata")) as unknown as {
      parseFile?: (filePath: string) => Promise<{
        common: {
          title?: string;
          artist?: string;
          album?: string;
          track: { no?: number | null };
        };
        format: { duration?: number };
      }>;
    };
    const parsed = metadataModule.parseFile ? await metadataModule.parseFile(filePath) : null;
    return {
      title: parsed?.common.title?.trim() || fallback.title,
      artist: parsed?.common.artist?.trim() || fallback.artist,
      album: parsed?.common.album?.trim() || fallback.album,
      trackNumber: parsed?.common.track.no ?? fallback.trackNumber,
      duration: Number.isFinite(parsed?.format.duration) ? parsed?.format.duration ?? 0 : 0
    };
  } catch {
    return { ...fallback, duration: 0 };
  }
}

export function resolveFfmpegPath() {
  return process.env.FFMPEG_PATH || resolveBundledFfmpegPath() || "ffmpeg";
}

async function runFfmpeg(binary: string, args: string[]) {
  await execFileAsync(binary, args);
}

function temporaryAudioPath(filePath: string) {
  const extension = path.extname(filePath);
  const basename = path.basename(filePath, extension);
  return path.join(path.dirname(filePath), `.${basename}.${process.pid}.${Date.now()}.metadata${extension}`);
}

function resolveBundledFfmpegPath() {
  try {
    const value = require("ffmpeg-static") as unknown;
    return typeof value === "string" && value ? value : null;
  } catch {
    return null;
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
npx vitest run src/main/metadataWriter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/metadataWriter.ts src/main/metadataWriter.test.ts
git commit -m "feat: add audio metadata writer"
```

---

### Task 4: Main And Preload IPC

**Files:**
- Modify: `electron/preload.cts`
- Modify: `electron/main.ts`
- Modify: `scripts/electron-preload.test.ts`

- [ ] **Step 1: Write failing source-level IPC tests**

Extend `scripts/electron-preload.test.ts` with:

```ts
  it("exposes track context menu APIs", async () => {
    const preloadSource = await readFile(path.join(process.cwd(), "electron/preload.cts"), "utf8");
    const mainSource = await readFile(path.join(process.cwd(), "electron/main.ts"), "utf8");

    expect(preloadSource).toContain("showTrackInFolder");
    expect(preloadSource).toContain("updateTrackMetadata");
    expect(preloadSource).toContain("trashTrackLyrics");
    expect(preloadSource).toContain("trashTrackFiles");
    expect(mainSource).toContain("media:show-track-in-folder");
    expect(mainSource).toContain("media:update-track-metadata");
    expect(mainSource).toContain("media:trash-track-lyrics");
    expect(mainSource).toContain("media:trash-track-files");
    expect(mainSource).toContain("showItemInFolder");
    expect(mainSource).toContain("trashItem");
  });
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npx vitest run scripts/electron-preload.test.ts
```

Expected: FAIL because the new API names are not present.

- [ ] **Step 3: Expose preload methods**

Update `electron/preload.cts` imports:

```ts
import type {
  ScanProgress,
  ScanResult,
  Track,
  TrackMetadataUpdate
} from "../src/shared/types.js";
```

Add methods inside `contextBridge.exposeInMainWorld("musicApi", { ... })`:

```ts
  showTrackInFolder: (filePath: string) => ipcRenderer.invoke("media:show-track-in-folder", filePath),
  updateTrackMetadata: (filePath: string, metadata: TrackMetadataUpdate) =>
    ipcRenderer.invoke("media:update-track-metadata", filePath, metadata),
  trashTrackLyrics: (track: Track) => ipcRenderer.invoke("media:trash-track-lyrics", track),
  trashTrackFiles: (track: Track) => ipcRenderer.invoke("media:trash-track-files", track),
```

- [ ] **Step 4: Register main handlers**

Update the Electron import in `electron/main.ts`:

```ts
import { app, BrowserWindow, dialog, ipcMain, Menu, shell, type MenuItemConstructorOptions, type OpenDialogOptions } from "electron";
```

Add imports:

```ts
import type { Track, TrackMetadataUpdate } from "../src/shared/types.js";
import { trashTrackFiles, trashTrackLyrics } from "../src/main/trackFileActions.js";
import { writeTrackMetadata } from "../src/main/metadataWriter.js";
```

Add these handlers inside `registerIpc()`:

```ts
  ipcMain.handle("media:show-track-in-folder", (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
    return { ok: true };
  });

  ipcMain.handle("media:update-track-metadata", (_event, filePath: string, metadata: TrackMetadataUpdate) => {
    return writeTrackMetadata(filePath, metadata);
  });

  ipcMain.handle("media:trash-track-lyrics", (_event, track: Track) => {
    return trashTrackLyrics(track, (filePath) => shell.trashItem(filePath));
  });

  ipcMain.handle("media:trash-track-files", (_event, track: Track) => {
    return trashTrackFiles(track, (filePath) => shell.trashItem(filePath));
  });
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
npx vitest run scripts/electron-preload.test.ts
npm run typecheck
```

Expected: preload test PASS. Typecheck may now fail only in renderer tests because `window.musicApi` mocks do not include the new methods.

- [ ] **Step 6: Commit**

```bash
git add electron/preload.cts electron/main.ts scripts/electron-preload.test.ts
git commit -m "feat: expose track file actions over ipc"
```

---

### Task 5: Context Menu And Edit Dialog Components

**Files:**
- Create: `src/renderer/components/TrackContextMenu.tsx`
- Create: `src/renderer/components/EditTrackMetadataDialog.tsx`
- Modify: `src/renderer/components/LibraryList.tsx`
- Modify: `src/renderer/components/LibraryList.test.tsx`
- Modify: `src/renderer/styles.css`

- [ ] **Step 1: Add failing component tests for right-click behavior**

Extend `src/renderer/components/LibraryList.test.tsx` with:

```tsx
  it("reports context menu requests for concrete track rows", () => {
    const onTrackContextMenu = vi.fn();
    render(
      <LibraryList
        category="songs"
        tracks={tracks}
        currentTrack={null}
        search=""
        selectedFolderPath={null}
        onSearchChange={vi.fn()}
        onSelectTrack={vi.fn()}
        onOpenFolder={vi.fn()}
        onBackToFolders={vi.fn()}
        onTrackContextMenu={onTrackContextMenu}
      />
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: /Track 001/ }), { clientX: 24, clientY: 48 });

    expect(onTrackContextMenu).toHaveBeenCalledWith(tracks[0], { x: 24, y: 48 });
  });
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npx vitest run src/renderer/components/LibraryList.test.tsx
```

Expected: FAIL because `onTrackContextMenu` is not a prop.

- [ ] **Step 3: Modify `LibraryList` to report right-clicks**

Add prop:

```ts
  onTrackContextMenu: (track: Track, position: { x: number; y: number }) => void;
```

Pass it to `TrackRow` in both concrete track render paths. In `TrackRow`, add:

```tsx
      onContextMenu={(event) => {
        event.preventDefault();
        onTrackContextMenu(track, { x: event.clientX, y: event.clientY });
      }}
```

The album, artist, and folder category row buttons do not receive `onContextMenu`.

- [ ] **Step 4: Create the context menu component**

Create `src/renderer/components/TrackContextMenu.tsx`:

```tsx
import { Edit3, FileText, FolderOpen, Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import type { Track } from "../../shared/types";

interface TrackContextMenuProps {
  track: Track;
  position: { x: number; y: number };
  busy: boolean;
  onClose: () => void;
  onShowInFolder: () => void;
  onEdit: () => void;
  onDeleteLyrics: () => void;
  onDeleteTrack: () => void;
}

const menuWidth = 236;
const menuHeight = 184;
const viewportPadding = 10;

export function TrackContextMenu({
  track,
  position,
  busy,
  onClose,
  onShowInFolder,
  onEdit,
  onDeleteLyrics,
  onDeleteTrack
}: TrackContextMenuProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const style = useMemo(() => {
    const left = Math.min(position.x, window.innerWidth - menuWidth - viewportPadding);
    const top = Math.min(position.y, window.innerHeight - menuHeight - viewportPadding);
    return { left: Math.max(viewportPadding, left), top: Math.max(viewportPadding, top) };
  }, [position.x, position.y]);

  const canDeleteLyrics = Boolean(track.hasLyrics && track.lyricsPath);

  return (
    <div className="context-menu-layer" onMouseDown={onClose}>
      <div className="track-context-menu" role="menu" style={style} onMouseDown={(event) => event.stopPropagation()}>
        <button role="menuitem" type="button" disabled={busy} onClick={onShowInFolder}>
          <FolderOpen size={16} />
          打开文件位置
        </button>
        <button role="menuitem" type="button" disabled={busy} onClick={onEdit}>
          <Edit3 size={16} />
          编辑音乐信息
        </button>
        <button role="menuitem" type="button" disabled={busy || !canDeleteLyrics} onClick={onDeleteLyrics}>
          <FileText size={16} />
          删除当前歌词
        </button>
        <button className="danger" role="menuitem" type="button" disabled={busy} onClick={onDeleteTrack}>
          <Trash2 size={16} />
          删除当前音乐文件
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create the edit dialog component**

Create `src/renderer/components/EditTrackMetadataDialog.tsx`:

```tsx
import { X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { Track, TrackMetadataUpdate } from "../../shared/types";

interface EditTrackMetadataDialogProps {
  track: Track;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (metadata: TrackMetadataUpdate) => void;
}

export function EditTrackMetadataDialog({ track, busy, error, onCancel, onSave }: EditTrackMetadataDialogProps) {
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [album, setAlbum] = useState(track.album);
  const [trackNumber, setTrackNumber] = useState(track.trackNumber?.toString() ?? "");

  const validationError = useMemo(() => {
    if (!title.trim()) return "标题不能为空";
    if (!artist.trim()) return "歌手不能为空";
    if (!album.trim()) return "专辑不能为空";
    if (trackNumber.trim() && (!/^\d+$/.test(trackNumber.trim()) || Number(trackNumber) <= 0)) {
      return "曲号必须是正整数";
    }
    return null;
  }, [album, artist, title, trackNumber]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (validationError) return;
    onSave({
      title: title.trim(),
      artist: artist.trim(),
      album: album.trim(),
      trackNumber: trackNumber.trim() ? Number(trackNumber.trim()) : null
    });
  };

  return (
    <div className="modal-layer" role="presentation">
      <form className="metadata-dialog" aria-label="编辑音乐信息" onSubmit={submit}>
        <div className="metadata-dialog-heading">
          <h2>编辑音乐信息</h2>
          <button type="button" aria-label="关闭编辑音乐信息" onClick={onCancel} disabled={busy}>
            <X size={16} />
          </button>
        </div>
        <label>
          标题
          <input value={title} onChange={(event) => setTitle(event.target.value)} disabled={busy} />
        </label>
        <label>
          歌手
          <input value={artist} onChange={(event) => setArtist(event.target.value)} disabled={busy} />
        </label>
        <label>
          专辑
          <input value={album} onChange={(event) => setAlbum(event.target.value)} disabled={busy} />
        </label>
        <label>
          曲号
          <input inputMode="numeric" value={trackNumber} onChange={(event) => setTrackNumber(event.target.value)} disabled={busy} />
        </label>
        {validationError || error ? <p className="metadata-dialog-error">{validationError ?? error}</p> : null}
        <div className="metadata-dialog-actions">
          <button type="button" onClick={onCancel} disabled={busy}>取消</button>
          <button type="submit" disabled={busy || Boolean(validationError)}>保存</button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Add styles**

Append styles to `src/renderer/styles.css` near playlist/menu-related UI rules:

```css
.context-menu-layer,
.modal-layer {
  position: fixed;
  inset: 0;
  z-index: 20;
}

.track-context-menu {
  position: fixed;
  width: 236px;
  padding: 6px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.16);
}

.track-context-menu button {
  width: 100%;
  height: 38px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  border-radius: 7px;
  padding: 0 10px;
  color: #1d1d1f;
  background: transparent;
  text-align: left;
}

.track-context-menu button:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.06);
}

.track-context-menu button.danger {
  color: #d70015;
}

.track-context-menu button:disabled {
  color: #a8a8ad;
  cursor: default;
}

.modal-layer {
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.24);
}

.metadata-dialog {
  width: min(420px, calc(100vw - 32px));
  display: grid;
  gap: 14px;
  border-radius: 12px;
  padding: 20px;
  background: #ffffff;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.24);
}

.metadata-dialog-heading,
.metadata-dialog-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.metadata-dialog h2 {
  margin: 0;
  font-size: 20px;
}

.metadata-dialog label {
  display: grid;
  gap: 6px;
  color: #4b4b52;
  font-size: 13px;
}

.metadata-dialog input {
  height: 38px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  padding: 0 10px;
  font: inherit;
}

.metadata-dialog-error {
  margin: 0;
  color: #d70015;
  font-size: 13px;
}
```

- [ ] **Step 7: Run tests**

Run:

```bash
npx vitest run src/renderer/components/LibraryList.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/components/TrackContextMenu.tsx src/renderer/components/EditTrackMetadataDialog.tsx src/renderer/components/LibraryList.tsx src/renderer/components/LibraryList.test.tsx src/renderer/styles.css
git commit -m "feat: add track context menu ui"
```

---

### Task 6: App State Synchronization

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/App.test.tsx`
- Modify: `src/renderer/hooks/useAudioPlayer.ts`
- Modify: `src/renderer/hooks/useAudioPlayer.test.tsx`

- [ ] **Step 1: Extend app test mocks**

In `src/renderer/App.test.tsx`, update `window.musicApi` in `beforeEach`:

```ts
    showTrackInFolder: vi.fn(async () => ({ ok: true })),
    updateTrackMetadata: vi.fn(async (_filePath, metadata) => ({ ok: true, metadata: { ...metadata, duration: 180 } })),
    trashTrackLyrics: vi.fn(async () => ({ ok: true })),
    trashTrackFiles: vi.fn(async () => ({ ok: true, audioRemoved: true, trashed: [], failed: [], error: null })),
```

- [ ] **Step 2: Add failing app tests**

Add tests to `src/renderer/App.test.tsx`:

```tsx
  it("opens the track context menu and disables lyric deletion when no lyrics exist", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.contextMenu(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }), {
      clientX: 40,
      clientY: 80
    });

    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "删除当前歌词" })).toBeDisabled();
  });

  it("saves edited metadata and updates visible track data", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.contextMenu(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "编辑音乐信息" }));
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "Edited Song" } });
    fireEvent.change(screen.getByLabelText("歌手"), { target: { value: "Edited Artist" } });
    fireEvent.change(screen.getByLabelText("专辑"), { target: { value: "Edited Album" } });
    fireEvent.change(screen.getByLabelText("曲号"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(window.musicApi.updateTrackMetadata).toHaveBeenCalledWith(track.filePath, {
      title: "Edited Song",
      artist: "Edited Artist",
      album: "Edited Album",
      trackNumber: 5
    }));
    expect(screen.getByText("Edited Song")).toBeTruthy();
    expect(screen.getByText("Edited Artist")).toBeTruthy();
    expect(screen.getByText("Edited Album")).toBeTruthy();
  });

  it("trashes lyrics and clears lyric state for the track", async () => {
    const trackWithLyrics = { ...track, lyricsPath: "/music/Wave Song.lrc", hasLyrics: true };
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify({ ...scanResult, tracks: [trackWithLyrics, secondTrack] }));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.contextMenu(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "删除当前歌词" }));

    await waitFor(() => expect(window.musicApi.trashTrackLyrics).toHaveBeenCalledWith(trackWithLyrics));
    const cached = JSON.parse(localStorage.getItem(libraryCacheKey) ?? "{}") as ScanResult;
    expect(cached.tracks[0].lyricsPath).toBeNull();
    expect(cached.tracks[0].hasLyrics).toBe(false);
  });

  it("trashes a track and removes it from library and playlist", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.contextMenu(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "删除当前音乐文件" }));

    await waitFor(() => expect(window.musicApi.trashTrackFiles).toHaveBeenCalledWith(track));
    expect(within(screen.getByRole("region", { name: "Library browser" })).queryByText("Wave Song")).toBeNull();
    expect(within(screen.getByRole("region", { name: "Playlist" })).queryByText("Wave Song")).toBeNull();
  });
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npx vitest run src/renderer/App.test.tsx
```

Expected: FAIL because `App` does not render the menu/dialog or call new APIs.

- [ ] **Step 4: Add audio hook helpers**

In `src/renderer/hooks/useAudioPlayer.ts`, add callbacks before the returned object:

```ts
  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const replaceCurrentTrack = useCallback((track: Track) => {
    setCurrentTrack((current) => (current?.id === track.id ? track : current));
  }, []);
```

Return `stop` and `replaceCurrentTrack`.

- [ ] **Step 5: Implement App orchestration**

Import new components in `src/renderer/App.tsx`:

```ts
import { EditTrackMetadataDialog } from "./components/EditTrackMetadataDialog";
import { TrackContextMenu } from "./components/TrackContextMenu";
```

Add state near other UI state:

```ts
  const [trackMenu, setTrackMenu] = useState<{ track: Track; position: { x: number; y: number } } | null>(null);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [pendingMediaAction, setPendingMediaAction] = useState(false);
```

Add helpers:

```ts
  const replaceTrack = useCallback((updatedTrack: Track) => {
    setTracks((currentTracks) => persistTracks(currentTracks.map((item) => (item.id === updatedTrack.id ? updatedTrack : item)), folderPath, warnings));
    setPlayQueue((queue) => queue.map((item) => (item.id === updatedTrack.id ? updatedTrack : item)));
    player.replaceCurrentTrack(updatedTrack);
  }, [folderPath, player, warnings]);

  const updateTrackLyricsState = useCallback((trackId: string) => {
    setTracks((currentTracks) =>
      persistTracks(
        currentTracks.map((item) => (item.id === trackId ? { ...item, lyricsPath: null, hasLyrics: false } : item)),
        folderPath,
        warnings
      )
    );
    setPlayQueue((queue) => queue.map((item) => (item.id === trackId ? { ...item, lyricsPath: null, hasLyrics: false } : item)));
    if (player.currentTrack?.id === trackId) {
      setLyrics(null);
      player.replaceCurrentTrack({ ...player.currentTrack, lyricsPath: null, hasLyrics: false });
    }
  }, [folderPath, player, warnings]);

  const removeTrackFromLibrary = useCallback((trackToRemove: Track) => {
    setTracks((currentTracks) => persistTracks(currentTracks.filter((item) => item.id !== trackToRemove.id), folderPath, warnings));
    setPlayQueue((queue) => queue.filter((item) => item.id !== trackToRemove.id));
    if (player.currentTrack?.id === trackToRemove.id) {
      player.stop();
    }
    removePlaybackStateForTrack(trackToRemove.id);
  }, [folderPath, player, warnings]);
```

Add action callbacks:

```ts
  const showTrackInFolder = useCallback(async (track: Track) => {
    setPendingMediaAction(true);
    setAppError(null);
    try {
      const result = await window.musicApi.showTrackInFolder(track.filePath);
      if (!result.ok) setAppError(result.error);
    } finally {
      setPendingMediaAction(false);
      setTrackMenu(null);
    }
  }, []);

  const saveTrackMetadata = useCallback(async (metadata: TrackMetadataUpdate) => {
    if (!editingTrack) return;
    setPendingMediaAction(true);
    setMetadataError(null);
    const result = await window.musicApi.updateTrackMetadata(editingTrack.filePath, metadata);
    setPendingMediaAction(false);
    if (!result.ok) {
      setMetadataError(result.error);
      return;
    }
    replaceTrack({ ...editingTrack, ...result.metadata });
    setEditingTrack(null);
  }, [editingTrack, replaceTrack]);

  const deleteTrackLyrics = useCallback(async (track: Track) => {
    setPendingMediaAction(true);
    setAppError(null);
    const result = await window.musicApi.trashTrackLyrics(track);
    setPendingMediaAction(false);
    setTrackMenu(null);
    if (!result.ok) {
      setAppError(result.error);
      return;
    }
    updateTrackLyricsState(track.id);
  }, [updateTrackLyricsState]);

  const deleteTrackFiles = useCallback(async (track: Track) => {
    const confirmed = window.confirm("将把当前音乐文件、同名歌词和同名封面移到废纸篓。是否继续？");
    if (!confirmed) {
      setTrackMenu(null);
      return;
    }
    setPendingMediaAction(true);
    setAppError(null);
    const result = await window.musicApi.trashTrackFiles(track);
    setPendingMediaAction(false);
    setTrackMenu(null);
    if (result.audioRemoved) {
      removeTrackFromLibrary(track);
    }
    if (!result.ok && result.error) {
      setAppError(result.error);
    }
  }, [removeTrackFromLibrary]);
```

Pass `onTrackContextMenu` to `LibraryList`:

```tsx
              onTrackContextMenu={(track, position) => setTrackMenu({ track, position })}
```

Render overlays before `PlayerBar`:

```tsx
      {trackMenu ? (
        <TrackContextMenu
          track={trackMenu.track}
          position={trackMenu.position}
          busy={pendingMediaAction}
          onClose={() => setTrackMenu(null)}
          onShowInFolder={() => void showTrackInFolder(trackMenu.track)}
          onEdit={() => {
            setMetadataError(null);
            setEditingTrack(trackMenu.track);
            setTrackMenu(null);
          }}
          onDeleteLyrics={() => void deleteTrackLyrics(trackMenu.track)}
          onDeleteTrack={() => void deleteTrackFiles(trackMenu.track)}
        />
      ) : null}

      {editingTrack ? (
        <EditTrackMetadataDialog
          track={editingTrack}
          busy={pendingMediaAction}
          error={metadataError}
          onCancel={() => setEditingTrack(null)}
          onSave={(metadata) => void saveTrackMetadata(metadata)}
        />
      ) : null}
```

Add helper functions below existing cache functions:

```ts
function persistTracks(nextTracks: Track[], folderPath: string | null, warnings: ScanWarning[]) {
  if (folderPath) {
    saveLibraryCache({ folderPath, tracks: nextTracks, warnings });
  }
  return nextTracks;
}

function removePlaybackStateForTrack(trackId: string) {
  const cachedValue = localStorage.getItem(PLAYBACK_STATE_STORAGE_KEY);
  if (!cachedValue) {
    return;
  }
  try {
    const parsed = JSON.parse(cachedValue) as PlaybackState;
    if (parsed.trackId === trackId) {
      localStorage.removeItem(PLAYBACK_STATE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      PLAYBACK_STATE_STORAGE_KEY,
      JSON.stringify({ ...parsed, queueTrackIds: parsed.queueTrackIds.filter((queuedTrackId) => queuedTrackId !== trackId) })
    );
  } catch {
    localStorage.removeItem(PLAYBACK_STATE_STORAGE_KEY);
  }
}
```

- [ ] **Step 6: Run app tests**

Run:

```bash
npx vitest run src/renderer/App.test.tsx src/renderer/hooks/useAudioPlayer.test.tsx
```

Expected: PASS after updating any hook tests that assert the returned hook shape.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/App.tsx src/renderer/App.test.tsx src/renderer/hooks/useAudioPlayer.ts src/renderer/hooks/useAudioPlayer.test.tsx
git commit -m "feat: sync track context actions with app state"
```

---

### Task 7: Full Verification And Polish

**Files:**
- No planned file edits. If a command fails, return to the task that owns the failing behavior and fix that task's files.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Start the app for manual UI verification**

Run:

```bash
npm run dev
```

Expected: Vite serves on `http://127.0.0.1:5173` and Electron opens the app. Manually verify:

- Right-click a track opens the menu at the pointer.
- Clicking outside and pressing Escape closes it.
- "打开文件位置" reveals the file.
- "编辑音乐信息" opens the dialog and saves to disk.
- "删除当前歌词" is disabled without lyrics and updates the track when enabled.
- "删除当前音乐文件" asks for confirmation and removes the track after trashing.

- [ ] **Step 5: Commit final polish**

If verification required fixes, commit them:

```bash
git add src electron scripts package.json package-lock.json
git commit -m "fix: polish track context menu behavior"
```

---

## Self-Review

Spec coverage:

- Right-click menu on songs is covered by Tasks 5 and 6.
- File reveal is covered by Task 4 and Task 6.
- Metadata writeback is covered by Tasks 1, 3, 4, and 6.
- Lyrics trashing is covered by Tasks 2, 4, and 6.
- Music file trashing with same-name sidecars and shared artwork exclusion is covered by Task 2 and Task 6.
- Renderer state, queue, cache, and playback synchronization are covered by Task 6.
- Error handling and verification are covered by Tasks 2, 3, 6, and 7.

Open-item scan:

- The plan contains no open-ended placeholder markers.
- Each code step includes concrete snippets, file paths, commands, and expected outcomes.

Type consistency:

- Shared types use `TrackMetadataUpdate`, `TrackMetadataFields`, `MediaActionResult`, `TrashTrackFilesResult`, and `UpdateTrackMetadataResult`.
- Preload method names match renderer usage: `showTrackInFolder`, `updateTrackMetadata`, `trashTrackLyrics`, and `trashTrackFiles`.
- Main IPC channel names match preload usage: `media:show-track-in-folder`, `media:update-track-metadata`, `media:trash-track-lyrics`, and `media:trash-track-files`.
