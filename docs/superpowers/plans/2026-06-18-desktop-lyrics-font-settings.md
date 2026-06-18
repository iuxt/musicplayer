# Desktop Lyrics Font Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent floating desktop lyrics window and independent font family/font size controls for fullscreen lyrics and desktop lyrics.

**Architecture:** Keep `App.tsx` as the playback and settings source of truth. Add shared lyric helpers, a focused desktop lyrics renderer mode, preload IPC methods, and Electron main-process window/font management. Settings stay in `localStorage` with migration from the current `fullscreenLyricsFontSize`-only shape.

**Tech Stack:** Electron 35, React 19, TypeScript, Vite, Vitest, Testing Library, lucide-react.

---

## Scope Check

The spec is cohesive enough for one plan. It spans renderer settings, renderer lyric display, preload IPC, and Electron main-process window support, but each part contributes to one testable feature: configurable fullscreen and desktop lyric typography with a persistent desktop lyrics window.

## File Structure

- Create `src/renderer/lyrics.ts`: shared LRC parsing, active-line lookup, next-line lookup, and desktop payload construction.
- Create `src/renderer/lyrics.test.ts`: unit tests for lyric parsing and desktop payload construction.
- Create `src/renderer/components/DesktopLyrics.tsx`: presentational desktop lyrics surface.
- Create `src/renderer/components/DesktopLyrics.test.tsx`: component tests for desktop lyrics rendering and controls.
- Create `src/renderer/DesktopLyricsWindow.tsx`: desktop-window renderer shell that receives payloads through preload IPC.
- Create `src/renderer/DesktopLyricsWindow.test.tsx`: tests for desktop-window IPC subscription behavior.
- Create `src/main/systemFonts.ts`: platform font enumeration with fallback list.
- Create `src/main/systemFonts.test.ts`: unit tests for system font parsing and fallback behavior.
- Create `scripts/electron-desktop-lyrics.test.ts`: source tests for Electron desktop lyrics window and IPC wiring.
- Modify `src/shared/types.ts`: add `DesktopLyricsPayload`.
- Modify `src/renderer/appSettings.ts`: extend settings model, defaults, validation, and write normalization.
- Modify `src/renderer/appSettings.test.ts`: cover migration and invalid-field handling.
- Modify `src/renderer/components/FullscreenLyrics.tsx`: consume shared lyric helpers and apply font family.
- Modify `src/renderer/components/FullscreenLyrics.test.tsx`: cover font family and keep size behavior.
- Modify `src/renderer/components/SettingsPage.tsx`: add fullscreen and desktop lyric font controls plus desktop lyrics toggle.
- Modify `src/renderer/components/SettingsPage.test.tsx`: cover new controls and callbacks.
- Modify `src/renderer/main.tsx`: choose between normal app mode and desktop lyrics mode.
- Modify `src/renderer/App.tsx`: load fonts, persist new settings, open/close desktop lyrics, and send desktop lyric payloads.
- Modify `src/renderer/App.test.tsx`: mock new APIs and cover desktop lyrics flows.
- Modify `src/renderer/styles.css`: add desktop lyrics styles and settings control styles; add fullscreen font family CSS variable.
- Modify `src/renderer/styles.test.ts`: assert desktop lyrics drag/no-drag and fullscreen font variables.
- Modify `src/vite-env.d.ts`: expose new preload API types.
- Modify `electron/preload.cts`: expose new IPC methods and listeners.
- Modify `electron/main.ts`: register font and desktop lyrics IPC, manage the desktop lyrics window, and forward commands/events.
- Modify `scripts/electron-preload.test.ts`: assert new preload API exposure.

---

### Task 1: Extend Shared Types And App Settings

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/renderer/appSettings.ts`
- Modify: `src/renderer/appSettings.test.ts`

- [ ] **Step 1: Write failing app settings tests**

Replace `src/renderer/appSettings.test.ts` with this content:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  APP_SETTINGS_STORAGE_KEY,
  DEFAULT_APP_SETTINGS,
  MAX_DESKTOP_LYRICS_FONT_SIZE,
  MAX_FULLSCREEN_LYRICS_FONT_SIZE,
  MIN_DESKTOP_LYRICS_FONT_SIZE,
  MIN_FULLSCREEN_LYRICS_FONT_SIZE,
  readAppSettings,
  writeAppSettings
} from "./appSettings";

describe("appSettings", () => {
  it("returns defaults when no settings are saved", () => {
    const storage = makeStorage();

    expect(readAppSettings(storage)).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("returns defaults when storage read throws", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("Storage unavailable");
      }),
      setItem: vi.fn()
    };

    expect(readAppSettings(storage)).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("returns defaults for invalid JSON and out-of-range font sizes", () => {
    expect(readAppSettings(makeStorage({ [APP_SETTINGS_STORAGE_KEY]: "not-json" }))).toEqual(DEFAULT_APP_SETTINGS);
    expect(
      readAppSettings(makeStorage({ [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({ fullscreenLyricsFontSize: 12 }) }))
    ).toEqual(DEFAULT_APP_SETTINGS);
    expect(
      readAppSettings(makeStorage({ [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({ fullscreenLyricsFontSize: 72 }) }))
    ).toEqual(DEFAULT_APP_SETTINGS);
    expect(
      readAppSettings(makeStorage({ [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({ fullscreenLyricsFontSize: "36" }) }))
    ).toEqual(DEFAULT_APP_SETTINGS);
    expect(
      readAppSettings(
        makeStorage({
          [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
            fullscreenLyricsFontSize: 36,
            desktopLyricsFontSize: 12
          })
        })
      )
    ).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("migrates a valid legacy fullscreen lyrics font size", () => {
    const storage = makeStorage({
      [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({ fullscreenLyricsFontSize: MAX_FULLSCREEN_LYRICS_FONT_SIZE })
    });

    expect(readAppSettings(storage)).toEqual({
      ...DEFAULT_APP_SETTINGS,
      fullscreenLyricsFontSize: MAX_FULLSCREEN_LYRICS_FONT_SIZE
    });
  });

  it("reads valid persisted lyric font settings", () => {
    const storage = makeStorage({
      [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
        fullscreenLyricsFontFamily: "PingFang SC",
        fullscreenLyricsFontSize: MAX_FULLSCREEN_LYRICS_FONT_SIZE,
        desktopLyricsEnabled: true,
        desktopLyricsFontFamily: "LXGW WenKai",
        desktopLyricsFontSize: MAX_DESKTOP_LYRICS_FONT_SIZE
      })
    });

    expect(readAppSettings(storage)).toEqual({
      fullscreenLyricsFontFamily: "PingFang SC",
      fullscreenLyricsFontSize: MAX_FULLSCREEN_LYRICS_FONT_SIZE,
      desktopLyricsEnabled: true,
      desktopLyricsFontFamily: "LXGW WenKai",
      desktopLyricsFontSize: MAX_DESKTOP_LYRICS_FONT_SIZE
    });
  });

  it("rounds valid persisted decimal lyric font sizes", () => {
    const storage = makeStorage({
      [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
        fullscreenLyricsFontFamily: "",
        fullscreenLyricsFontSize: 36.6,
        desktopLyricsEnabled: false,
        desktopLyricsFontFamily: "",
        desktopLyricsFontSize: 28.4
      })
    });

    expect(readAppSettings(storage)).toEqual({
      ...DEFAULT_APP_SETTINGS,
      fullscreenLyricsFontSize: 37,
      desktopLyricsFontSize: 28
    });
  });

  it("writes normalized settings", () => {
    const storage = makeStorage();

    writeAppSettings(
      {
        fullscreenLyricsFontFamily: "PingFang SC",
        fullscreenLyricsFontSize: MIN_FULLSCREEN_LYRICS_FONT_SIZE,
        desktopLyricsEnabled: true,
        desktopLyricsFontFamily: "LXGW WenKai",
        desktopLyricsFontSize: MIN_DESKTOP_LYRICS_FONT_SIZE
      },
      storage
    );

    expect(storage.setItem).toHaveBeenCalledWith(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        fullscreenLyricsFontFamily: "PingFang SC",
        fullscreenLyricsFontSize: MIN_FULLSCREEN_LYRICS_FONT_SIZE,
        desktopLyricsEnabled: true,
        desktopLyricsFontFamily: "LXGW WenKai",
        desktopLyricsFontSize: MIN_DESKTOP_LYRICS_FONT_SIZE
      })
    );
  });

  it("returns fallback settings without exposing the default settings object", () => {
    const settings = readAppSettings(makeStorage());

    settings.fullscreenLyricsFontSize = 48;
    settings.desktopLyricsEnabled = true;

    expect(DEFAULT_APP_SETTINGS).toEqual({
      fullscreenLyricsFontFamily: "",
      fullscreenLyricsFontSize: 36,
      desktopLyricsEnabled: false,
      desktopLyricsFontFamily: "",
      desktopLyricsFontSize: 28
    });
    expect(readAppSettings(makeStorage())).toEqual(DEFAULT_APP_SETTINGS);
  });
});

function makeStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    })
  };
}
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
npm test -- src/renderer/appSettings.test.ts
```

Expected: FAIL with TypeScript or assertion errors mentioning missing `MAX_DESKTOP_LYRICS_FONT_SIZE`, `MIN_DESKTOP_LYRICS_FONT_SIZE`, or missing fields on `AppSettings`.

- [ ] **Step 3: Add the desktop lyrics payload type**

Append this interface to `src/shared/types.ts` after `UpdateTrackMetadataResult`:

```ts
export interface DesktopLyricsPayload {
  trackTitle: string | null;
  artist: string | null;
  currentLine: string | null;
  nextLine: string | null;
  isLoading: boolean;
  fontFamily: string;
  fontSize: number;
}
```

- [ ] **Step 4: Extend and normalize app settings**

Replace `src/renderer/appSettings.ts` with this content:

```ts
export const APP_SETTINGS_STORAGE_KEY = "musicplayer:settings";
export const MIN_FULLSCREEN_LYRICS_FONT_SIZE = 24;
export const MAX_FULLSCREEN_LYRICS_FONT_SIZE = 56;
export const MIN_DESKTOP_LYRICS_FONT_SIZE = 18;
export const MAX_DESKTOP_LYRICS_FONT_SIZE = 44;

export interface AppSettings {
  fullscreenLyricsFontFamily: string;
  fullscreenLyricsFontSize: number;
  desktopLyricsEnabled: boolean;
  desktopLyricsFontFamily: string;
  desktopLyricsFontSize: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  fullscreenLyricsFontFamily: "",
  fullscreenLyricsFontSize: 36,
  desktopLyricsEnabled: false,
  desktopLyricsFontFamily: "",
  desktopLyricsFontSize: 28
};

type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

export function readAppSettings(storage: SettingsStorage = localStorage): AppSettings {
  try {
    const savedValue = storage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!savedValue) {
      return defaultAppSettings();
    }

    return normalizeAppSettings(JSON.parse(savedValue) as unknown);
  } catch {
    return defaultAppSettings();
  }
}

export function writeAppSettings(settings: AppSettings, storage: SettingsStorage = localStorage) {
  storage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeAppSettings(settings)));
}

export function normalizeAppSettings(value: unknown): AppSettings {
  if (!isRecord(value)) {
    return defaultAppSettings();
  }

  const fullscreenFontSize = normalizeFontSize(
    value.fullscreenLyricsFontSize,
    MIN_FULLSCREEN_LYRICS_FONT_SIZE,
    MAX_FULLSCREEN_LYRICS_FONT_SIZE
  );
  if (fullscreenFontSize === null) {
    return defaultAppSettings();
  }

  const desktopFontSizeValue = value.desktopLyricsFontSize ?? DEFAULT_APP_SETTINGS.desktopLyricsFontSize;
  const desktopFontSize = normalizeFontSize(
    desktopFontSizeValue,
    MIN_DESKTOP_LYRICS_FONT_SIZE,
    MAX_DESKTOP_LYRICS_FONT_SIZE
  );
  if (desktopFontSize === null) {
    return defaultAppSettings();
  }

  const fullscreenFontFamily = value.fullscreenLyricsFontFamily ?? DEFAULT_APP_SETTINGS.fullscreenLyricsFontFamily;
  const desktopFontFamily = value.desktopLyricsFontFamily ?? DEFAULT_APP_SETTINGS.desktopLyricsFontFamily;
  const desktopLyricsEnabled = value.desktopLyricsEnabled ?? DEFAULT_APP_SETTINGS.desktopLyricsEnabled;

  if (
    typeof fullscreenFontFamily !== "string" ||
    typeof desktopFontFamily !== "string" ||
    typeof desktopLyricsEnabled !== "boolean"
  ) {
    return defaultAppSettings();
  }

  return {
    fullscreenLyricsFontFamily: fullscreenFontFamily.trim(),
    fullscreenLyricsFontSize: fullscreenFontSize,
    desktopLyricsEnabled,
    desktopLyricsFontFamily: desktopFontFamily.trim(),
    desktopLyricsFontSize: desktopFontSize
  };
}

function normalizeFontSize(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    return null;
  }

  return Math.round(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function defaultAppSettings(): AppSettings {
  return { ...DEFAULT_APP_SETTINGS };
}
```

- [ ] **Step 5: Run tests for settings**

Run:

```bash
npm test -- src/renderer/appSettings.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit settings model**

Run:

```bash
git add src/shared/types.ts src/renderer/appSettings.ts src/renderer/appSettings.test.ts
git commit -m "feat: extend lyric settings model"
```

---

### Task 2: Extract Shared Lyric Helpers

**Files:**
- Create: `src/renderer/lyrics.ts`
- Create: `src/renderer/lyrics.test.ts`
- Modify: `src/renderer/components/FullscreenLyrics.tsx`
- Modify: `src/renderer/components/FullscreenLyrics.test.tsx`

- [ ] **Step 1: Write failing shared lyric helper tests**

Create `src/renderer/lyrics.test.ts` with this content:

```ts
import { describe, expect, it } from "vitest";
import type { Track } from "../shared/types";
import { buildDesktopLyricsPayload, findActiveLine, findNextLine, parseLyrics } from "./lyrics";

describe("lyrics helpers", () => {
  it("parses timed LRC lines and sorts them", () => {
    expect(parseLyrics("[00:10.00]Second\n[00:01.50]First")).toEqual([
      { id: "1-0", time: 1.5, text: "First" },
      { id: "0-0", time: 10, text: "Second" }
    ]);
  });

  it("finds the active and next lyric lines", () => {
    const lines = parseLyrics("[00:01.00]First\n[00:12.50]Current\n[00:30.00]Later");
    const active = findActiveLine(lines, 13);

    expect(active?.text).toBe("Current");
    expect(findNextLine(lines, active)?.text).toBe("Later");
  });

  it("builds a desktop lyrics payload for a timed lyric", () => {
    expect(
      buildDesktopLyricsPayload({
        track: makeTrack({ hasLyrics: true, lyricsPath: "/music/song.lrc" }),
        lyrics: "[00:01.00]First\n[00:12.50]Current\n[00:30.00]Later",
        isLyricsLoading: false,
        currentTime: 13,
        fontFamily: "PingFang SC",
        fontSize: 30
      })
    ).toEqual({
      trackTitle: "Song",
      artist: "Artist",
      currentLine: "Current",
      nextLine: "Later",
      isLoading: false,
      fontFamily: "PingFang SC",
      fontSize: 30
    });
  });

  it("builds loading, no-lyrics, and no-track desktop payloads", () => {
    expect(
      buildDesktopLyricsPayload({
        track: makeTrack({ hasLyrics: true, lyricsPath: "/music/song.lrc" }),
        lyrics: null,
        isLyricsLoading: true,
        currentTime: 0,
        fontFamily: "",
        fontSize: 28
      }).currentLine
    ).toBe("正在加载歌词...");

    expect(
      buildDesktopLyricsPayload({
        track: makeTrack({ hasLyrics: false, lyricsPath: null }),
        lyrics: null,
        isLyricsLoading: false,
        currentTime: 0,
        fontFamily: "",
        fontSize: 28
      }).currentLine
    ).toBe("未找到歌词。");

    expect(
      buildDesktopLyricsPayload({
        track: null,
        lyrics: null,
        isLyricsLoading: false,
        currentTime: 0,
        fontFamily: "",
        fontSize: 28
      }).currentLine
    ).toBe("暂无播放");
  });
});

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: "track-1",
    filePath: "/music/song.flac",
    title: "Song",
    artist: "Artist",
    album: "Album",
    duration: 180,
    trackNumber: null,
    extension: "flac",
    artworkId: null,
    artworkPath: "/music/cover.jpg",
    lyricsPath: "/music/song.lrc",
    hasLyrics: true,
    folderPath: "/music",
    ...overrides
  };
}
```

- [ ] **Step 2: Run the failing helper tests**

Run:

```bash
npm test -- src/renderer/lyrics.test.ts
```

Expected: FAIL because `src/renderer/lyrics.ts` does not exist.

- [ ] **Step 3: Create shared lyric helpers**

Create `src/renderer/lyrics.ts` with this content:

```ts
import type { DesktopLyricsPayload, Track } from "../shared/types";

export interface LyricLine {
  id: string;
  time: number | null;
  text: string;
}

interface DesktopLyricsPayloadInput {
  track: Track | null;
  lyrics: string | null;
  isLyricsLoading: boolean;
  currentTime: number;
  fontFamily: string;
  fontSize: number;
}

export function parseLyrics(lyrics: string | null): LyricLine[] {
  if (!lyrics) {
    return [];
  }

  return lyrics
    .split(/\r?\n/)
    .flatMap<LyricLine>((line, index) => {
      const timestamps = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
      const text = line.replace(/\[[^\]]+\]/g, "").trim();
      if (!text) {
        return [];
      }
      if (timestamps.length === 0) {
        return [{ id: `plain-${index}`, time: null, text }];
      }
      return timestamps.map<LyricLine>((match, timestampIndex) => ({
        id: `${index}-${timestampIndex}`,
        time: Number(match[1]) * 60 + Number(match[2]) + Number(`0.${(match[3] ?? "0").padEnd(3, "0")}`),
        text
      }));
    })
    .sort((left, right) => (left.time ?? Number.MAX_SAFE_INTEGER) - (right.time ?? Number.MAX_SAFE_INTEGER));
}

export function findActiveLine(lines: LyricLine[], currentTime: number): LyricLine | null {
  const activeIndex = findActiveLineIndex(lines, currentTime);
  return activeIndex >= 0 ? lines[activeIndex] : null;
}

export function findActiveLineIndex(lines: LyricLine[], currentTime: number) {
  let activeIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const time = lines[index].time;
    if (time === null || time > currentTime) {
      break;
    }
    activeIndex = index;
  }

  return activeIndex;
}

export function findNextLine(lines: LyricLine[], activeLine: LyricLine | null): LyricLine | null {
  if (!activeLine) {
    return lines[0] ?? null;
  }

  const activeIndex = lines.findIndex((line) => line.id === activeLine.id);
  if (activeIndex < 0) {
    return null;
  }

  return lines[activeIndex + 1] ?? null;
}

export function buildDesktopLyricsPayload({
  track,
  lyrics,
  isLyricsLoading,
  currentTime,
  fontFamily,
  fontSize
}: DesktopLyricsPayloadInput): DesktopLyricsPayload {
  if (!track) {
    return {
      trackTitle: null,
      artist: null,
      currentLine: "暂无播放",
      nextLine: null,
      isLoading: false,
      fontFamily,
      fontSize
    };
  }

  if (isLyricsLoading) {
    return {
      trackTitle: track.title,
      artist: track.artist,
      currentLine: "正在加载歌词...",
      nextLine: null,
      isLoading: true,
      fontFamily,
      fontSize
    };
  }

  const lines = parseLyrics(lyrics);
  if (lines.length === 0) {
    return {
      trackTitle: track.title,
      artist: track.artist,
      currentLine: track.hasLyrics ? "未找到歌词。" : "未找到歌词。",
      nextLine: null,
      isLoading: false,
      fontFamily,
      fontSize
    };
  }

  const activeLine = findActiveLine(lines, currentTime) ?? lines[0];
  const nextLine = findNextLine(lines, activeLine);

  return {
    trackTitle: track.title,
    artist: track.artist,
    currentLine: activeLine.text,
    nextLine: nextLine?.text ?? null,
    isLoading: false,
    fontFamily,
    fontSize
  };
}
```

- [ ] **Step 4: Run helper tests**

Run:

```bash
npm test -- src/renderer/lyrics.test.ts
```

Expected: PASS.

- [ ] **Step 5: Update fullscreen lyrics tests for font family**

In `src/renderer/components/FullscreenLyrics.test.tsx`, add `fullscreenLyricsFontFamily="PingFang SC"` to both existing `FullscreenLyrics` render calls. Replace the second test with:

```ts
  it("applies the configured fullscreen lyrics font family and size", () => {
    render(
      <FullscreenLyrics
        track={track}
        artworkUrl="file:///cover.jpg"
        lyrics={"[00:01.00]Custom size line"}
        isLyricsLoading={false}
        currentTime={2}
        fullscreenLyricsFontFamily="PingFang SC"
        fullscreenLyricsFontSize={48}
        onClose={() => undefined}
      />
    );

    const fullscreenLyrics = screen.getByRole("region", { name: "全屏歌词" });
    expect((fullscreenLyrics as HTMLElement).style.getPropertyValue("--fullscreen-lyrics-font-family")).toContain("PingFang SC");
    expect((fullscreenLyrics as HTMLElement).style.getPropertyValue("--fullscreen-lyrics-font-size")).toBe("48px");
  });
```

- [ ] **Step 6: Run the failing fullscreen lyrics test**

Run:

```bash
npm test -- src/renderer/components/FullscreenLyrics.test.tsx
```

Expected: FAIL because `fullscreenLyricsFontFamily` is not a prop.

- [ ] **Step 7: Refactor `FullscreenLyrics` to use shared helpers and font family**

In `src/renderer/components/FullscreenLyrics.tsx`, replace the imports with:

```ts
import { Disc3, X } from "lucide-react";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { Track } from "../../shared/types";
import { findActiveLineIndex, parseLyrics } from "../lyrics";
```

Replace the props interface with:

```ts
interface FullscreenLyricsProps {
  track: Track | null;
  artworkUrl: string | null;
  lyrics: string | null;
  isLyricsLoading: boolean;
  currentTime: number;
  fullscreenLyricsFontFamily: string;
  fullscreenLyricsFontSize: number;
  onClose: () => void;
}
```

Add `fullscreenLyricsFontFamily` to the destructuring list. Replace the `activeIndex` and `lyricsStyle` block with:

```ts
  const activeIndex = useMemo(() => findActiveLineIndex(lines, currentTime), [currentTime, lines]);
  const lyricsStyle = {
    "--fullscreen-lyrics-font-family": fullscreenLyricsFontFamily
      ? `"${fullscreenLyricsFontFamily}", ui-sans-serif, system-ui, sans-serif`
      : "ui-sans-serif, system-ui, sans-serif",
    "--fullscreen-lyrics-font-size": `${fullscreenLyricsFontSize}px`
  } as CSSProperties & Record<"--fullscreen-lyrics-font-family" | "--fullscreen-lyrics-font-size", string>;
```

Delete the local `LyricLine` interface, `parseLyrics` function, and `findActiveLine` function from the bottom of the file.

- [ ] **Step 8: Run fullscreen lyrics tests**

Run:

```bash
npm test -- src/renderer/components/FullscreenLyrics.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit shared lyric helpers**

Run:

```bash
git add src/renderer/lyrics.ts src/renderer/lyrics.test.ts src/renderer/components/FullscreenLyrics.tsx src/renderer/components/FullscreenLyrics.test.tsx
git commit -m "feat: share lyric timing helpers"
```

---

### Task 3: Add Desktop Lyrics Renderer Components

**Files:**
- Create: `src/renderer/components/DesktopLyrics.tsx`
- Create: `src/renderer/components/DesktopLyrics.test.tsx`
- Create: `src/renderer/DesktopLyricsWindow.tsx`
- Create: `src/renderer/DesktopLyricsWindow.test.tsx`
- Modify: `src/renderer/main.tsx`
- Modify: `src/vite-env.d.ts`

- [ ] **Step 1: Write failing `DesktopLyrics` component tests**

Create `src/renderer/components/DesktopLyrics.test.tsx` with this content:

```ts
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DesktopLyricsPayload } from "../../shared/types";
import { DesktopLyrics } from "./DesktopLyrics";

describe("DesktopLyrics", () => {
  it("renders the current and next lyric lines with configured typography", () => {
    render(
      <DesktopLyrics
        payload={{
          trackTitle: "Song",
          artist: "Artist",
          currentLine: "当前歌词",
          nextLine: "下一句歌词",
          isLoading: false,
          fontFamily: "LXGW WenKai",
          fontSize: 30
        }}
        onClose={() => undefined}
        onOpenSettings={() => undefined}
      />
    );

    const surface = screen.getByRole("region", { name: "桌面歌词" });
    expect(screen.getByText("当前歌词")).toBeTruthy();
    expect(screen.getByText("下一句歌词")).toBeTruthy();
    expect((surface as HTMLElement).style.getPropertyValue("--desktop-lyrics-font-family")).toContain("LXGW WenKai");
    expect((surface as HTMLElement).style.getPropertyValue("--desktop-lyrics-font-size")).toBe("30px");
  });

  it("calls close and settings callbacks", () => {
    const onClose = vi.fn();
    const onOpenSettings = vi.fn();

    render(<DesktopLyrics payload={makePayload()} onClose={onClose} onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByRole("button", { name: "关闭桌面歌词" }));
    fireEvent.click(screen.getByRole("button", { name: "打开歌词设置" }));

    expect(onClose).toHaveBeenCalled();
    expect(onOpenSettings).toHaveBeenCalled();
  });
});

function makePayload(): DesktopLyricsPayload {
  return {
    trackTitle: "Song",
    artist: "Artist",
    currentLine: "当前歌词",
    nextLine: null,
    isLoading: false,
    fontFamily: "",
    fontSize: 28
  };
}
```

- [ ] **Step 2: Run the failing `DesktopLyrics` tests**

Run:

```bash
npm test -- src/renderer/components/DesktopLyrics.test.tsx
```

Expected: FAIL because `DesktopLyrics.tsx` does not exist.

- [ ] **Step 3: Create `DesktopLyrics`**

Create `src/renderer/components/DesktopLyrics.tsx` with this content:

```tsx
import { Settings, X } from "lucide-react";
import type { CSSProperties } from "react";
import type { DesktopLyricsPayload } from "../../shared/types";

interface DesktopLyricsProps {
  payload: DesktopLyricsPayload;
  onClose: () => void;
  onOpenSettings: () => void;
}

export function DesktopLyrics({ payload, onClose, onOpenSettings }: DesktopLyricsProps) {
  const style = {
    "--desktop-lyrics-font-family": payload.fontFamily
      ? `"${payload.fontFamily}", ui-sans-serif, system-ui, sans-serif`
      : "ui-sans-serif, system-ui, sans-serif",
    "--desktop-lyrics-font-size": `${payload.fontSize}px`
  } as CSSProperties & Record<"--desktop-lyrics-font-family" | "--desktop-lyrics-font-size", string>;

  return (
    <section className="desktop-lyrics-shell" aria-label="桌面歌词" style={style}>
      <div className="desktop-lyrics-controls">
        <button className="desktop-lyrics-control" type="button" aria-label="打开歌词设置" onClick={onOpenSettings}>
          <Settings size={14} />
        </button>
        <button className="desktop-lyrics-control" type="button" aria-label="关闭桌面歌词" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      <p className={payload.isLoading ? "desktop-lyrics-current loading" : "desktop-lyrics-current"}>
        {payload.currentLine ?? "暂无播放"}
      </p>
      {payload.nextLine ? <p className="desktop-lyrics-next">{payload.nextLine}</p> : null}
    </section>
  );
}
```

- [ ] **Step 4: Run `DesktopLyrics` tests**

Run:

```bash
npm test -- src/renderer/components/DesktopLyrics.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Write failing desktop window tests**

Create `src/renderer/DesktopLyricsWindow.test.tsx` with this content:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DesktopLyricsPayload } from "../shared/types";
import { DesktopLyricsWindow } from "./DesktopLyricsWindow";

let updateHandler: ((payload: DesktopLyricsPayload) => void) | null = null;

beforeEach(() => {
  updateHandler = null;
  window.musicApi = {
    chooseMusicFolder: vi.fn(),
    rescanLibrary: vi.fn(),
    getPlayableUrl: vi.fn(),
    getArtworkUrl: vi.fn(),
    getLyrics: vi.fn(),
    showTrackInFolder: vi.fn(),
    updateTrackMetadata: vi.fn(),
    trashTrackLyrics: vi.fn(),
    trashTrackFiles: vi.fn(),
    listSystemFonts: vi.fn(async () => []),
    showDesktopLyrics: vi.fn(async () => undefined),
    closeDesktopLyrics: vi.fn(async () => undefined),
    updateDesktopLyrics: vi.fn(async () => undefined),
    openMainSettingsFromDesktopLyrics: vi.fn(async () => undefined),
    onDesktopLyricsUpdate: vi.fn((callback) => {
      updateHandler = callback;
      return () => {
        updateHandler = null;
      };
    }),
    onDesktopLyricsClosed: vi.fn(() => () => undefined),
    onScanProgress: vi.fn(() => () => undefined),
    onMenuCommand: vi.fn(() => () => undefined)
  };
});

describe("DesktopLyricsWindow", () => {
  it("renders updates received from the desktop lyrics channel", () => {
    render(<DesktopLyricsWindow />);

    act(() => {
      updateHandler?.({
        trackTitle: "Song",
        artist: "Artist",
        currentLine: "同步歌词",
        nextLine: "下一句",
        isLoading: false,
        fontFamily: "",
        fontSize: 28
      });
    });

    expect(screen.getByText("同步歌词")).toBeTruthy();
    expect(screen.getByText("下一句")).toBeTruthy();
  });

  it("delegates close and settings actions to preload APIs", () => {
    render(<DesktopLyricsWindow />);
    fireEvent.click(screen.getByRole("button", { name: "打开歌词设置" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭桌面歌词" }));

    expect(window.musicApi.openMainSettingsFromDesktopLyrics).toHaveBeenCalled();
    expect(window.musicApi.closeDesktopLyrics).toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run the failing desktop window tests**

Run:

```bash
npm test -- src/renderer/DesktopLyricsWindow.test.tsx
```

Expected: FAIL because `DesktopLyricsWindow.tsx` does not exist.

- [ ] **Step 7: Create desktop window renderer shell**

Create `src/renderer/DesktopLyricsWindow.tsx` with this content:

```tsx
import { useEffect, useState } from "react";
import type { DesktopLyricsPayload } from "../shared/types";
import { DesktopLyrics } from "./components/DesktopLyrics";

const INITIAL_PAYLOAD: DesktopLyricsPayload = {
  trackTitle: null,
  artist: null,
  currentLine: "暂无播放",
  nextLine: null,
  isLoading: false,
  fontFamily: "",
  fontSize: 28
};

export function DesktopLyricsWindow() {
  const [payload, setPayload] = useState<DesktopLyricsPayload>(INITIAL_PAYLOAD);

  useEffect(() => {
    return window.musicApi.onDesktopLyricsUpdate(setPayload);
  }, []);

  return (
    <DesktopLyrics
      payload={payload}
      onClose={() => {
        void window.musicApi.closeDesktopLyrics();
      }}
      onOpenSettings={() => {
        void window.musicApi.openMainSettingsFromDesktopLyrics();
      }}
    />
  );
}
```

- [ ] **Step 8: Update renderer entry mode**

Replace `src/renderer/main.tsx` with this content:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { DesktopLyricsWindow } from "./DesktopLyricsWindow";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
const params = new URLSearchParams(window.location.search);
const isDesktopLyricsWindow = params.get("window") === "desktop-lyrics";

root.render(
  <React.StrictMode>
    {isDesktopLyricsWindow ? <DesktopLyricsWindow /> : <App />}
  </React.StrictMode>
);
```

- [ ] **Step 9: Update renderer API type declarations for desktop lyrics**

In `src/vite-env.d.ts`, add `DesktopLyricsPayload` to the import list from `./shared/types`. Add these fields inside `musicApi`:

```ts
      listSystemFonts: () => Promise<string[]>;
      showDesktopLyrics: () => Promise<void>;
      closeDesktopLyrics: () => Promise<void>;
      updateDesktopLyrics: (payload: DesktopLyricsPayload) => Promise<void>;
      openMainSettingsFromDesktopLyrics: () => Promise<void>;
      onDesktopLyricsUpdate: (callback: (payload: DesktopLyricsPayload) => void) => () => void;
      onDesktopLyricsClosed: (callback: () => void) => () => void;
```

- [ ] **Step 10: Run desktop renderer tests**

Run:

```bash
npm test -- src/renderer/components/DesktopLyrics.test.tsx src/renderer/DesktopLyricsWindow.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Commit desktop lyrics renderer**

Run:

```bash
git add src/renderer/components/DesktopLyrics.tsx src/renderer/components/DesktopLyrics.test.tsx src/renderer/DesktopLyricsWindow.tsx src/renderer/DesktopLyricsWindow.test.tsx src/renderer/main.tsx src/vite-env.d.ts
git commit -m "feat: add desktop lyrics renderer"
```

---

### Task 4: Add System Font Enumeration

**Files:**
- Create: `src/main/systemFonts.ts`
- Create: `src/main/systemFonts.test.ts`

- [ ] **Step 1: Write failing system font tests**

Create `src/main/systemFonts.test.ts` with this content:

```ts
import { describe, expect, it, vi } from "vitest";
import { FALLBACK_SYSTEM_FONTS, listSystemFonts, normalizeFontNames, parseFcListOutput, parseMacFontOutput } from "./systemFonts";

describe("systemFonts", () => {
  it("normalizes, deduplicates, and sorts font names", () => {
    expect(normalizeFontNames([" PingFang SC ", "", "Arial", "PingFang SC"])).toEqual(["Arial", "PingFang SC"]);
  });

  it("parses macOS system_profiler JSON font output", () => {
    const output = JSON.stringify({
      SPFontsDataType: [
        { family: "PingFang SC" },
        { typefaces: [{ family: "LXGW WenKai" }, { family: "PingFang SC" }] }
      ]
    });

    expect(parseMacFontOutput(output)).toEqual(["LXGW WenKai", "PingFang SC"]);
  });

  it("parses Linux fc-list output", () => {
    expect(parseFcListOutput("Noto Sans CJK SC\nArial\nNoto Sans CJK SC\n")).toEqual(["Arial", "Noto Sans CJK SC"]);
  });

  it("returns fallback fonts when enumeration fails", async () => {
    const execFile = vi.fn((_file, _args, callback) => {
      callback(new Error("missing command"), "", "");
    });

    await expect(listSystemFonts({ platform: "linux", execFile })).resolves.toEqual(FALLBACK_SYSTEM_FONTS);
  });
});
```

- [ ] **Step 2: Run the failing font tests**

Run:

```bash
npm test -- src/main/systemFonts.test.ts
```

Expected: FAIL because `src/main/systemFonts.ts` does not exist.

- [ ] **Step 3: Implement font enumeration helper**

Create `src/main/systemFonts.ts` with this content:

```ts
import { execFile as defaultExecFile } from "node:child_process";

export const FALLBACK_SYSTEM_FONTS = [
  "",
  "PingFang SC",
  "Microsoft YaHei",
  "Noto Sans CJK SC",
  "LXGW WenKai",
  "Arial",
  "Helvetica"
];

type ExecFile = typeof defaultExecFile;

interface ListSystemFontsOptions {
  platform?: NodeJS.Platform;
  execFile?: ExecFile;
}

export async function listSystemFonts({
  platform = process.platform,
  execFile = defaultExecFile
}: ListSystemFontsOptions = {}) {
  try {
    if (platform === "darwin") {
      return withFallback(parseMacFontOutput(await execFileText(execFile, "system_profiler", ["SPFontsDataType", "-json"])));
    }
    if (platform === "linux") {
      return withFallback(parseFcListOutput(await execFileText(execFile, "fc-list", [":", "family"])));
    }
    if (platform === "win32") {
      return withFallback(
        parsePowerShellFontOutput(
          await execFileText(execFile, "powershell.exe", [
            "-NoProfile",
            "-Command",
            "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Drawing'); (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }"
          ])
        )
      );
    }
    return FALLBACK_SYSTEM_FONTS;
  } catch {
    return FALLBACK_SYSTEM_FONTS;
  }
}

export function parseMacFontOutput(output: string) {
  const parsed = JSON.parse(output) as unknown;
  const names: string[] = [];
  collectFontFamilies(parsed, names);
  return normalizeFontNames(names);
}

export function parseFcListOutput(output: string) {
  return normalizeFontNames(
    output
      .split(/\r?\n/)
      .flatMap((line) => line.split(","))
      .map((name) => name.trim())
  );
}

export function parsePowerShellFontOutput(output: string) {
  return normalizeFontNames(output.split(/\r?\n/));
}

export function normalizeFontNames(names: string[]) {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" })
  );
}

function withFallback(names: string[]) {
  return names.length > 0 ? ["", ...names] : FALLBACK_SYSTEM_FONTS;
}

function collectFontFamilies(value: unknown, names: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectFontFamilies(item, names));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (typeof value.family === "string") {
    names.push(value.family);
  }

  Object.values(value).forEach((item) => collectFontFamilies(item, names));
}

function execFileText(execFile: ExecFile, command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    execFile(command, args, { maxBuffer: 1024 * 1024 * 8 }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
```

- [ ] **Step 4: Run font tests**

Run:

```bash
npm test -- src/main/systemFonts.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit font enumeration helper**

Run:

```bash
git add src/main/systemFonts.ts src/main/systemFonts.test.ts
git commit -m "feat: list system fonts"
```

---

### Task 5: Add Settings Page Font Controls

**Files:**
- Modify: `src/renderer/components/SettingsPage.tsx`
- Modify: `src/renderer/components/SettingsPage.test.tsx`

- [ ] **Step 1: Replace SettingsPage tests with new control coverage**

Replace `src/renderer/components/SettingsPage.test.tsx` with this content:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  it("renders library actions and disables rescan without a folder", () => {
    const props = makeProps({ folderPath: null });

    render(<SettingsPage {...props} />);

    expect(screen.getByRole("region", { name: "设置" })).toBeTruthy();
    expect(screen.getByText("尚未选择音乐文件夹。")).toBeTruthy();
    expect((screen.getByRole("button", { name: "重新扫描音乐库" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables rescan while scanning an existing folder", () => {
    const props = makeProps({ folderPath: "/Users/test/Music", isScanning: true });

    render(<SettingsPage {...props} />);

    expect((screen.getByRole("button", { name: "重新扫描音乐库" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls library action callbacks", () => {
    const props = makeProps({ folderPath: "/Users/test/Music" });

    render(<SettingsPage {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "选择文件夹" }));
    fireEvent.click(screen.getByRole("button", { name: "重新扫描音乐库" }));
    fireEvent.click(screen.getByRole("button", { name: "清除音乐库缓存" }));

    expect(props.onChooseFolder).toHaveBeenCalled();
    expect(props.onRescanLibrary).toHaveBeenCalled();
    expect(props.onClearLibraryCache).toHaveBeenCalled();
  });

  it("shows cache status and cache error messages", () => {
    render(
      <SettingsPage
        {...makeProps({
          cacheStatus: "音乐库缓存已清除。",
          cacheError: "无法清除音乐库缓存。"
        })}
      />
    );

    expect(screen.getByRole("status").textContent).toBe("音乐库缓存已清除。");
    expect(screen.getByRole("alert").textContent).toBe("无法清除音乐库缓存。");
  });

  it("changes fullscreen lyrics font settings", () => {
    const props = makeProps({ fullscreenLyricsFontFamily: "", fullscreenLyricsFontSize: 36 });

    render(<SettingsPage {...props} />);
    fireEvent.change(screen.getByLabelText("全屏歌词字体"), { target: { value: "PingFang SC" } });
    fireEvent.change(screen.getByLabelText("全屏歌词字号"), { target: { value: "48" } });

    expect(props.onFullscreenLyricsFontFamilyChange).toHaveBeenCalledWith("PingFang SC");
    expect(props.onFullscreenLyricsFontSizeChange).toHaveBeenCalledWith(48);
  });

  it("changes desktop lyrics settings", () => {
    const props = makeProps({ desktopLyricsEnabled: false, desktopLyricsFontFamily: "", desktopLyricsFontSize: 28 });

    render(<SettingsPage {...props} />);
    fireEvent.click(screen.getByLabelText("显示桌面歌词"));
    fireEvent.change(screen.getByLabelText("桌面歌词字体"), { target: { value: "LXGW WenKai" } });
    fireEvent.change(screen.getByLabelText("桌面歌词字号"), { target: { value: "32" } });

    expect(props.onDesktopLyricsEnabledChange).toHaveBeenCalledWith(true);
    expect(props.onDesktopLyricsFontFamilyChange).toHaveBeenCalledWith("LXGW WenKai");
    expect(props.onDesktopLyricsFontSizeChange).toHaveBeenCalledWith(32);
  });
});

function makeProps(overrides: Partial<Parameters<typeof SettingsPage>[0]> = {}): Parameters<typeof SettingsPage>[0] {
  return {
    folderPath: "/Users/test/Music",
    isScanning: false,
    availableFontFamilies: ["", "PingFang SC", "LXGW WenKai"],
    fullscreenLyricsFontFamily: "",
    fullscreenLyricsFontSize: 36,
    desktopLyricsEnabled: false,
    desktopLyricsFontFamily: "",
    desktopLyricsFontSize: 28,
    cacheStatus: null,
    cacheError: null,
    onChooseFolder: vi.fn(),
    onRescanLibrary: vi.fn(),
    onClearLibraryCache: vi.fn(),
    onFullscreenLyricsFontFamilyChange: vi.fn(),
    onFullscreenLyricsFontSizeChange: vi.fn(),
    onDesktopLyricsEnabledChange: vi.fn(),
    onDesktopLyricsFontFamilyChange: vi.fn(),
    onDesktopLyricsFontSizeChange: vi.fn(),
    ...overrides
  };
}
```

- [ ] **Step 2: Run failing SettingsPage tests**

Run:

```bash
npm test -- src/renderer/components/SettingsPage.test.tsx
```

Expected: FAIL because `SettingsPage` does not accept the new props.

- [ ] **Step 3: Update SettingsPage props and controls**

In `src/renderer/components/SettingsPage.tsx`, replace the imports with:

```tsx
import { FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import {
  MAX_DESKTOP_LYRICS_FONT_SIZE,
  MAX_FULLSCREEN_LYRICS_FONT_SIZE,
  MIN_DESKTOP_LYRICS_FONT_SIZE,
  MIN_FULLSCREEN_LYRICS_FONT_SIZE
} from "../appSettings";
```

Replace `SettingsPageProps` with:

```tsx
interface SettingsPageProps {
  folderPath: string | null;
  isScanning: boolean;
  availableFontFamilies: string[];
  fullscreenLyricsFontFamily: string;
  fullscreenLyricsFontSize: number;
  desktopLyricsEnabled: boolean;
  desktopLyricsFontFamily: string;
  desktopLyricsFontSize: number;
  cacheStatus: string | null;
  cacheError: string | null;
  onChooseFolder: () => void;
  onRescanLibrary: () => void;
  onClearLibraryCache: () => void;
  onFullscreenLyricsFontFamilyChange: (fontFamily: string) => void;
  onFullscreenLyricsFontSizeChange: (fontSize: number) => void;
  onDesktopLyricsEnabledChange: (enabled: boolean) => void;
  onDesktopLyricsFontFamilyChange: (fontFamily: string) => void;
  onDesktopLyricsFontSizeChange: (fontSize: number) => void;
}
```

Update the function parameter destructuring to include every prop above. Replace the lyrics section JSX with:

```tsx
      <section className="settings-section" aria-labelledby="lyrics-settings-heading">
        <div className="settings-section-heading">
          <h3 id="lyrics-settings-heading">歌词</h3>
          <p>分别调整全屏歌词和桌面歌词的字体。</p>
        </div>

        <div className="lyrics-settings-group">
          <h4>全屏歌词</h4>
          <label className="lyrics-select-control">
            <span>字体</span>
            <select
              aria-label="全屏歌词字体"
              onChange={(event) => onFullscreenLyricsFontFamilyChange(event.target.value)}
              value={fullscreenLyricsFontFamily}
            >
              {availableFontFamilies.map((fontFamily) => (
                <option key={fontFamily || "system-default"} value={fontFamily}>
                  {fontFamily || "系统默认"}
                </option>
              ))}
            </select>
          </label>
          <label className="lyrics-size-control">
            <span>字号</span>
            <strong>{fullscreenLyricsFontSize}px</strong>
            <input
              aria-label="全屏歌词字号"
              max={MAX_FULLSCREEN_LYRICS_FONT_SIZE}
              min={MIN_FULLSCREEN_LYRICS_FONT_SIZE}
              onChange={(event) => onFullscreenLyricsFontSizeChange(Number(event.target.value))}
              step="1"
              type="range"
              value={fullscreenLyricsFontSize}
            />
          </label>
          <p className="lyrics-preview" style={{ fontFamily: fullscreenLyricsFontFamily || undefined, fontSize: `${fullscreenLyricsFontSize}px` }}>
            全屏歌词预览行
          </p>
        </div>

        <div className="lyrics-settings-group">
          <h4>桌面歌词</h4>
          <label className="setting-toggle">
            <input
              aria-label="显示桌面歌词"
              checked={desktopLyricsEnabled}
              onChange={(event) => onDesktopLyricsEnabledChange(event.target.checked)}
              type="checkbox"
            />
            <span>显示桌面歌词</span>
          </label>
          <label className="lyrics-select-control">
            <span>字体</span>
            <select
              aria-label="桌面歌词字体"
              onChange={(event) => onDesktopLyricsFontFamilyChange(event.target.value)}
              value={desktopLyricsFontFamily}
            >
              {availableFontFamilies.map((fontFamily) => (
                <option key={fontFamily || "system-default"} value={fontFamily}>
                  {fontFamily || "系统默认"}
                </option>
              ))}
            </select>
          </label>
          <label className="lyrics-size-control">
            <span>字号</span>
            <strong>{desktopLyricsFontSize}px</strong>
            <input
              aria-label="桌面歌词字号"
              max={MAX_DESKTOP_LYRICS_FONT_SIZE}
              min={MIN_DESKTOP_LYRICS_FONT_SIZE}
              onChange={(event) => onDesktopLyricsFontSizeChange(Number(event.target.value))}
              step="1"
              type="range"
              value={desktopLyricsFontSize}
            />
          </label>
          <div className="desktop-lyrics-preview" style={{ fontFamily: desktopLyricsFontFamily || undefined, fontSize: `${desktopLyricsFontSize}px` }}>
            <p>桌面歌词预览行</p>
            <span>下一句歌词预览</span>
          </div>
        </div>
      </section>
```

- [ ] **Step 4: Run SettingsPage tests**

Run:

```bash
npm test -- src/renderer/components/SettingsPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit settings UI**

Run:

```bash
git add src/renderer/components/SettingsPage.tsx src/renderer/components/SettingsPage.test.tsx
git commit -m "feat: add lyric font settings controls"
```

---

### Task 6: Add Preload IPC Exposure

**Files:**
- Modify: `electron/preload.cts`
- Modify: `scripts/electron-preload.test.ts`

- [ ] **Step 1: Update preload source tests**

Replace the second test in `scripts/electron-preload.test.ts` with:

```ts
  it("exposes track context menu and desktop lyrics APIs", async () => {
    const preloadSource = await readFile(path.join(process.cwd(), "electron/preload.cts"), "utf8");
    const mainSource = await readFile(path.join(process.cwd(), "electron/main.ts"), "utf8");

    expect(preloadSource).toContain("showTrackInFolder");
    expect(preloadSource).toContain("updateTrackMetadata");
    expect(preloadSource).toContain("trashTrackLyrics");
    expect(preloadSource).toContain("trashTrackFiles");
    expect(preloadSource).toContain("listSystemFonts");
    expect(preloadSource).toContain("showDesktopLyrics");
    expect(preloadSource).toContain("closeDesktopLyrics");
    expect(preloadSource).toContain("updateDesktopLyrics");
    expect(preloadSource).toContain("onDesktopLyricsUpdate");
    expect(preloadSource).toContain("onDesktopLyricsClosed");
    expect(preloadSource).toContain("openMainSettingsFromDesktopLyrics");
    expect(mainSource).toContain("media:show-track-in-folder");
    expect(mainSource).toContain("media:update-track-metadata");
    expect(mainSource).toContain("media:trash-track-lyrics");
    expect(mainSource).toContain("media:trash-track-files");
    expect(mainSource).toContain("showItemInFolder");
    expect(mainSource).toContain("trashItem");
  });
```

- [ ] **Step 2: Run failing preload source test**

Run:

```bash
npm test -- scripts/electron-preload.test.ts
```

Expected: FAIL because the preload source does not contain desktop lyrics API names.

- [ ] **Step 3: Update preload IPC exposure**

In `electron/preload.cts`, add `DesktopLyricsPayload` to the type import from `../src/shared/types.js`. Add these methods inside the object passed to `contextBridge.exposeInMainWorld("musicApi", ...)`, after `trashTrackFiles`:

```ts
  listSystemFonts: (): Promise<string[]> => ipcRenderer.invoke("fonts:list-system"),
  showDesktopLyrics: (): Promise<void> => ipcRenderer.invoke("desktop-lyrics:show"),
  closeDesktopLyrics: (): Promise<void> => ipcRenderer.invoke("desktop-lyrics:close"),
  updateDesktopLyrics: (payload: DesktopLyricsPayload): Promise<void> => ipcRenderer.invoke("desktop-lyrics:update", payload),
  openMainSettingsFromDesktopLyrics: (): Promise<void> => ipcRenderer.invoke("desktop-lyrics:open-settings"),
  onDesktopLyricsUpdate: (callback: (payload: DesktopLyricsPayload) => void) => {
    const listener = (_event: IpcRendererEvent, payload: DesktopLyricsPayload) => callback(payload);
    ipcRenderer.on("desktop-lyrics:update", listener);
    return () => ipcRenderer.removeListener("desktop-lyrics:update", listener);
  },
  onDesktopLyricsClosed: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("desktop-lyrics:closed", listener);
    return () => ipcRenderer.removeListener("desktop-lyrics:closed", listener);
  },
```

- [ ] **Step 4: Run preload source test**

Run:

```bash
npm test -- scripts/electron-preload.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run renderer desktop tests from Task 3**

Run:

```bash
npm test -- src/renderer/components/DesktopLyrics.test.tsx src/renderer/DesktopLyricsWindow.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit preload exposure**

Run:

```bash
git add electron/preload.cts scripts/electron-preload.test.ts
git commit -m "feat: expose desktop lyrics ipc"
```

---

### Task 7: Add Electron Main Desktop Lyrics Window Support

**Files:**
- Modify: `electron/main.ts`
- Modify: `scripts/electron-preload.test.ts`
- Create: `scripts/electron-desktop-lyrics.test.ts`

- [ ] **Step 1: Add Electron desktop lyrics source tests**

Create `scripts/electron-desktop-lyrics.test.ts` with this content:

```ts
// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Electron desktop lyrics window", () => {
  it("registers desktop lyrics and font IPC channels", async () => {
    const mainSource = await readFile(path.join(process.cwd(), "electron/main.ts"), "utf8");

    expect(mainSource).toContain("desktop-lyrics:show");
    expect(mainSource).toContain("desktop-lyrics:close");
    expect(mainSource).toContain("desktop-lyrics:update");
    expect(mainSource).toContain("desktop-lyrics:open-settings");
    expect(mainSource).toContain("fonts:list-system");
  });

  it("creates a transparent always-on-top desktop lyrics window", async () => {
    const mainSource = await readFile(path.join(process.cwd(), "electron/main.ts"), "utf8");

    expect(mainSource).toContain("transparent: true");
    expect(mainSource).toContain("frame: false");
    expect(mainSource).toContain("alwaysOnTop: true");
    expect(mainSource).toContain("skipTaskbar: true");
    expect(mainSource).toContain("window=desktop-lyrics");
    expect(mainSource).toContain("desktopLyricsWindow");
  });
});
```

- [ ] **Step 2: Run failing Electron desktop lyrics tests**

Run:

```bash
npm test -- scripts/electron-desktop-lyrics.test.ts scripts/electron-preload.test.ts
```

Expected: FAIL because `electron/main.ts` lacks desktop lyrics and fonts IPC.

- [ ] **Step 3: Add imports to `electron/main.ts`**

Keep the existing Electron import line unchanged. Add this import after scanner imports:

```ts
import { listSystemFonts } from "../src/main/systemFonts.js";
```

Add `DesktopLyricsPayload` to the existing type import:

```ts
import type { DesktopLyricsPayload, Track, TrackMetadataUpdate } from "../src/shared/types.js";
```

- [ ] **Step 4: Add desktop lyrics window state and helpers**

In `electron/main.ts`, add these variables below `const appDisplayName = "音乐播放器";`:

```ts
let mainWindow: BrowserWindow | null = null;
let desktopLyricsWindow: BrowserWindow | null = null;
let latestDesktopLyricsPayload: DesktopLyricsPayload | null = null;
```

Add this helper after `sendMenuCommand`:

```ts
function getRendererUrl(windowMode?: "desktop-lyrics") {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (!devServerUrl) {
    return null;
  }

  if (windowMode === "desktop-lyrics") {
    return `${devServerUrl}?window=desktop-lyrics`;
  }

  return devServerUrl;
}

async function loadRendererWindow(win: BrowserWindow, windowMode?: "desktop-lyrics") {
  const rendererUrl = getRendererUrl(windowMode);
  if (rendererUrl) {
    await win.loadURL(rendererUrl);
    return;
  }

  const filePath = path.join(__dirname, "../../dist/index.html");
  const query = windowMode === "desktop-lyrics" ? { window: "desktop-lyrics" } : undefined;
  await win.loadFile(filePath, query ? { query } : undefined);
}

async function showDesktopLyricsWindow() {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.show();
    desktopLyricsWindow.focus();
    if (latestDesktopLyricsPayload) {
      desktopLyricsWindow.webContents.send("desktop-lyrics:update", latestDesktopLyricsPayload);
    }
    return;
  }

  desktopLyricsWindow = new BrowserWindow({
    width: 720,
    height: 130,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  desktopLyricsWindow.on("closed", () => {
    desktopLyricsWindow = null;
    mainWindow?.webContents.send("desktop-lyrics:closed");
  });

  await loadRendererWindow(desktopLyricsWindow, "desktop-lyrics");
  if (latestDesktopLyricsPayload) {
    desktopLyricsWindow.webContents.send("desktop-lyrics:update", latestDesktopLyricsPayload);
  }
}

function closeDesktopLyricsWindow() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow = null;
    return;
  }

  desktopLyricsWindow.close();
}

function updateDesktopLyricsWindow(payload: DesktopLyricsPayload) {
  latestDesktopLyricsPayload = payload;
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) {
    return;
  }

  desktopLyricsWindow.webContents.send("desktop-lyrics:update", payload);
}
```

- [ ] **Step 5: Register desktop lyrics and font IPC**

Inside `registerIpc()`, after the existing media handlers, add:

```ts
  ipcMain.handle("fonts:list-system", () => {
    return listSystemFonts();
  });

  ipcMain.handle("desktop-lyrics:show", async () => {
    await showDesktopLyricsWindow();
  });

  ipcMain.handle("desktop-lyrics:close", () => {
    closeDesktopLyricsWindow();
  });

  ipcMain.handle("desktop-lyrics:update", (_event, payload: DesktopLyricsPayload) => {
    updateDesktopLyricsWindow(payload);
  });

  ipcMain.handle("desktop-lyrics:open-settings", () => {
    mainWindow?.show();
    mainWindow?.focus();
    mainWindow?.webContents.send("library:menu-command", "open-settings");
  });
```

- [ ] **Step 6: Track main window and load renderer through helper**

In `createWindow()`, after constructing `win`, add:

```ts
  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
    closeDesktopLyricsWindow();
  });
```

Replace the dev/prod load block in `createWindow()`:

```ts
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await win.loadURL(devServerUrl);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
```

with:

```ts
  await loadRendererWindow(win);
  if (process.env.VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools({ mode: "detach" });
  }
```

- [ ] **Step 7: Extend menu command type for settings command**

Change:

```ts
type MenuCommand = "choose-folder" | "rescan-library";
```

to:

```ts
type MenuCommand = "choose-folder" | "rescan-library" | "open-settings";
```

- [ ] **Step 8: Run Electron source tests**

Run:

```bash
npm test -- scripts/electron-desktop-lyrics.test.ts scripts/electron-preload.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run Electron typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS after all tasks that add renderer API usage are complete. If running this task alone before Task 8, expected failures are renderer prop mismatches that Task 8 resolves.

- [ ] **Step 10: Commit Electron main support**

Run:

```bash
git add electron/main.ts scripts/electron-desktop-lyrics.test.ts scripts/electron-preload.test.ts
git commit -m "feat: manage desktop lyrics window"
```

---

### Task 8: Integrate Settings, Fonts, And Desktop Lyrics In App

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/App.test.tsx`
- Modify: `src/renderer/components/FullscreenLyrics.tsx`

- [ ] **Step 1: Extend App test mocks**

In `src/renderer/App.test.tsx`, add the new methods to the `window.musicApi = { ... }` object in `beforeEach`:

```ts
    listSystemFonts: vi.fn(async () => ["", "PingFang SC", "LXGW WenKai"]),
    showDesktopLyrics: vi.fn(async () => undefined),
    closeDesktopLyrics: vi.fn(async () => undefined),
    updateDesktopLyrics: vi.fn(async () => undefined),
    openMainSettingsFromDesktopLyrics: vi.fn(async () => undefined),
    onDesktopLyricsUpdate: vi.fn(() => () => undefined),
    onDesktopLyricsClosed: vi.fn(() => () => undefined),
```

Add this variable near `menuHandler`:

```ts
let desktopLyricsClosedHandler: (() => void) | null = null;
```

Replace the `onDesktopLyricsClosed` mock with:

```ts
    onDesktopLyricsClosed: vi.fn((callback) => {
      desktopLyricsClosedHandler = callback;
      return () => {
        desktopLyricsClosedHandler = null;
      };
    }),
```

- [ ] **Step 2: Add failing App integration tests**

Add these tests near the existing settings tests in `src/renderer/App.test.tsx`:

```tsx
  it("loads system fonts for lyric font controls", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

    render(<App />);

    await waitFor(() => expect(window.musicApi.listSystemFonts).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "设置" }));

    expect(screen.getByRole("option", { name: "PingFang SC" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "LXGW WenKai" })).toBeTruthy();
  });

  it("persists fullscreen lyrics font family and applies it to fullscreen lyrics", async () => {
    const trackWithLyrics = { ...track, lyricsPath: "/music/Wave Song.lrc", hasLyrics: true };
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify({ ...scanResult, tracks: [trackWithLyrics] }));
    window.musicApi.getLyrics = vi.fn(async () => "[00:00.00]Preview lyric");

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.change(screen.getByLabelText("全屏歌词字体"), { target: { value: "PingFang SC" } });
    fireEvent.change(screen.getByLabelText("全屏歌词字号"), { target: { value: "48" } });

    expect(JSON.parse(localStorage.getItem(appSettingsKey) ?? "{}")).toMatchObject({
      fullscreenLyricsFontFamily: "PingFang SC",
      fullscreenLyricsFontSize: 48
    });

    fireEvent.click(screen.getByRole("button", { name: "歌曲" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "打开全屏歌词" }));

    expect(await screen.findByText("Preview lyric")).toBeTruthy();
    const fullscreenLyrics = screen.getByRole("region", { name: "全屏歌词" });
    expect((fullscreenLyrics as HTMLElement).style.getPropertyValue("--fullscreen-lyrics-font-family")).toContain("PingFang SC");
    expect((fullscreenLyrics as HTMLElement).style.getPropertyValue("--fullscreen-lyrics-font-size")).toBe("48px");
  });

  it("opens and updates desktop lyrics when enabled", async () => {
    const trackWithLyrics = { ...track, lyricsPath: "/music/Wave Song.lrc", hasLyrics: true };
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify({ ...scanResult, tracks: [trackWithLyrics] }));
    window.musicApi.getLyrics = vi.fn(async () => "[00:00.00]Desktop current\n[00:10.00]Desktop next");

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.change(screen.getByLabelText("桌面歌词字体"), { target: { value: "LXGW WenKai" } });
    fireEvent.change(screen.getByLabelText("桌面歌词字号"), { target: { value: "32" } });
    fireEvent.click(screen.getByLabelText("显示桌面歌词"));

    expect(window.musicApi.showDesktopLyrics).toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(appSettingsKey) ?? "{}")).toMatchObject({
      desktopLyricsEnabled: true,
      desktopLyricsFontFamily: "LXGW WenKai",
      desktopLyricsFontSize: 32
    });

    fireEvent.click(screen.getByRole("button", { name: "歌曲" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    });

    await waitFor(() =>
      expect(window.musicApi.updateDesktopLyrics).toHaveBeenLastCalledWith(
        expect.objectContaining({
          trackTitle: "Wave Song",
          artist: "Artist",
          currentLine: "Desktop current",
          nextLine: "Desktop next",
          fontFamily: "LXGW WenKai",
          fontSize: 32
        })
      )
    );
  });

  it("disables persisted desktop lyrics when the desktop window closes", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    localStorage.setItem(appSettingsKey, JSON.stringify({ ...defaultStoredSettings(), desktopLyricsEnabled: true }));

    render(<App />);

    await waitFor(() => expect(window.musicApi.showDesktopLyrics).toHaveBeenCalled());
    act(() => {
      desktopLyricsClosedHandler?.();
    });

    expect(JSON.parse(localStorage.getItem(appSettingsKey) ?? "{}")).toMatchObject({ desktopLyricsEnabled: false });
  });
```

Add this helper near `playbackStateWriteCount`:

```ts
function defaultStoredSettings() {
  return {
    fullscreenLyricsFontFamily: "",
    fullscreenLyricsFontSize: 36,
    desktopLyricsEnabled: false,
    desktopLyricsFontFamily: "",
    desktopLyricsFontSize: 28
  };
}
```

- [ ] **Step 3: Run failing App tests**

Run:

```bash
npm test -- src/renderer/App.test.tsx
```

Expected: FAIL because `App.tsx` does not pass new props, load fonts, or manage desktop lyrics.

- [ ] **Step 4: Add App font state and settings helpers**

In `src/renderer/App.tsx`, add `buildDesktopLyricsPayload` import:

```ts
import { buildDesktopLyricsPayload } from "./lyrics";
```

Add state after `appSettings`:

```ts
  const [availableFontFamilies, setAvailableFontFamilies] = useState<string[]>([""]);
```

Add this block in the current location of `changeFullscreenLyricsFontSize`, replacing the old `changeFullscreenLyricsFontSize` callback:

```ts
  const commitAppSettings = useCallback((updater: (currentSettings: AppSettings) => AppSettings) => {
    setAppSettings((currentSettings) => {
      const nextSettings = normalizeAppSettings(updater(currentSettings));
      try {
        writeAppSettings(nextSettings);
      } catch {
        setAppError("无法保存设置。");
      }
      return nextSettings;
    });
  }, []);

  const changeFullscreenLyricsFontFamily = useCallback(
    (fontFamily: string) => {
      commitAppSettings((currentSettings) => ({ ...currentSettings, fullscreenLyricsFontFamily: fontFamily }));
    },
    [commitAppSettings]
  );

  const changeFullscreenLyricsFontSize = useCallback(
    (fontSize: number) => {
      commitAppSettings((currentSettings) => ({ ...currentSettings, fullscreenLyricsFontSize: fontSize }));
    },
    [commitAppSettings]
  );

  const changeDesktopLyricsEnabled = useCallback(
    (enabled: boolean) => {
      commitAppSettings((currentSettings) => ({ ...currentSettings, desktopLyricsEnabled: enabled }));
    },
    [commitAppSettings]
  );

  const changeDesktopLyricsFontFamily = useCallback(
    (fontFamily: string) => {
      commitAppSettings((currentSettings) => ({ ...currentSettings, desktopLyricsFontFamily: fontFamily }));
    },
    [commitAppSettings]
  );

  const changeDesktopLyricsFontSize = useCallback(
    (fontSize: number) => {
      commitAppSettings((currentSettings) => ({ ...currentSettings, desktopLyricsFontSize: fontSize }));
    },
    [commitAppSettings]
  );
```

Move the existing `openSettings` callback above the `window.musicApi.onMenuCommand` effect, using this exact callback body:

```ts
  const openSettings = useCallback(() => {
    setActiveView("settings");
    setCacheStatus(null);
    setCacheError(null);
  }, []);
```

Delete the old `openSettings` callback from its later location.

- [ ] **Step 5: Add font loading and desktop lyrics effects**

In `src/renderer/App.tsx`, add these effects before `chooseFolder`:

```ts
  useEffect(() => {
    let cancelled = false;
    void window.musicApi
      .listSystemFonts()
      .then((fontFamilies) => {
        if (!cancelled) {
          setAvailableFontFamilies(fontFamilies.length > 0 ? fontFamilies : [""]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableFontFamilies(["", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "LXGW WenKai", "Arial", "Helvetica"]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const desktopLyricsPayload = useMemo(
    () =>
      buildDesktopLyricsPayload({
        track: player.currentTrack,
        lyrics,
        isLyricsLoading,
        currentTime: player.currentTime,
        fontFamily: appSettings.desktopLyricsFontFamily,
        fontSize: appSettings.desktopLyricsFontSize
      }),
    [
      appSettings.desktopLyricsFontFamily,
      appSettings.desktopLyricsFontSize,
      isLyricsLoading,
      lyrics,
      player.currentTime,
      player.currentTrack
    ]
  );

  useEffect(() => {
    if (!appSettings.desktopLyricsEnabled) {
      void window.musicApi.closeDesktopLyrics();
      return;
    }

    void window.musicApi.showDesktopLyrics().catch(() => {
      setAppError("无法打开桌面歌词。");
      commitAppSettings((currentSettings) => ({ ...currentSettings, desktopLyricsEnabled: false }));
    });
  }, [appSettings.desktopLyricsEnabled, commitAppSettings]);

  useEffect(() => {
    if (!appSettings.desktopLyricsEnabled) {
      return;
    }

    void window.musicApi.updateDesktopLyrics(desktopLyricsPayload).catch(() => {
      setAppError("无法更新桌面歌词。");
    });
  }, [appSettings.desktopLyricsEnabled, desktopLyricsPayload]);

  useEffect(() => {
    return window.musicApi.onDesktopLyricsClosed(() => {
      commitAppSettings((currentSettings) => ({ ...currentSettings, desktopLyricsEnabled: false }));
    });
  }, [commitAppSettings]);
```

- [ ] **Step 6: Handle open-settings menu command**

In the `onMenuCommand` effect, add:

```ts
      if (command === "open-settings") {
        openSettings();
      }
```

Add `openSettings` to the dependency array of that effect.

- [ ] **Step 7: Pass new SettingsPage and FullscreenLyrics props**

In the `SettingsPage` JSX, add:

```tsx
            availableFontFamilies={availableFontFamilies}
            fullscreenLyricsFontFamily={appSettings.fullscreenLyricsFontFamily}
            desktopLyricsEnabled={appSettings.desktopLyricsEnabled}
            desktopLyricsFontFamily={appSettings.desktopLyricsFontFamily}
            desktopLyricsFontSize={appSettings.desktopLyricsFontSize}
            onFullscreenLyricsFontFamilyChange={changeFullscreenLyricsFontFamily}
            onDesktopLyricsEnabledChange={changeDesktopLyricsEnabled}
            onDesktopLyricsFontFamilyChange={changeDesktopLyricsFontFamily}
            onDesktopLyricsFontSizeChange={changeDesktopLyricsFontSize}
```

Keep the existing `fullscreenLyricsFontSize` and `onFullscreenLyricsFontSizeChange` props, but ensure the callback points to the new `changeFullscreenLyricsFontSize`.

In the `FullscreenLyrics` JSX, add:

```tsx
          fullscreenLyricsFontFamily={appSettings.fullscreenLyricsFontFamily}
```

- [ ] **Step 8: Run App tests**

Run:

```bash
npm test -- src/renderer/App.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit App integration**

Run:

```bash
git add src/renderer/App.tsx src/renderer/App.test.tsx
git commit -m "feat: sync desktop lyrics from app"
```

---

### Task 9: Add Styles For Lyric Font Controls And Desktop Lyrics

**Files:**
- Modify: `src/renderer/styles.css`
- Modify: `src/renderer/styles.test.ts`

- [ ] **Step 1: Add failing style tests**

Add these tests to `src/renderer/styles.test.ts`:

```ts
  it("scopes lyric font families through CSS variables", async () => {
    const css = await readStyles();

    expect(rule(css, ".fullscreen-lyric-line")).toContain("font-family: var(--fullscreen-lyrics-font-family");
    expect(rule(css, ".fullscreen-lyrics-empty")).toContain("font-family: var(--fullscreen-lyrics-font-family");
    expect(rule(css, ".desktop-lyrics-shell")).toContain("font-family: var(--desktop-lyrics-font-family");
  });

  it("makes desktop lyrics draggable while controls remain clickable", async () => {
    const css = await readStyles();

    expect(rule(css, ".desktop-lyrics-shell")).toContain("-webkit-app-region: drag");
    expect(rule(css, ".desktop-lyrics-control")).toContain("-webkit-app-region: no-drag");
  });
```

- [ ] **Step 2: Run failing style tests**

Run:

```bash
npm test -- src/renderer/styles.test.ts
```

Expected: FAIL because the CSS does not contain desktop lyrics rules or fullscreen font family rules.

- [ ] **Step 3: Add settings control styles**

In `src/renderer/styles.css`, add these styles near the existing lyrics settings styles:

```css
.lyrics-settings-group {
  display: grid;
  gap: 12px;
  padding-top: 4px;
}

.lyrics-settings-group + .lyrics-settings-group {
  padding-top: 16px;
  border-top: 1px solid #ececf0;
}

.lyrics-settings-group h4 {
  margin: 0;
  color: #1d1d1f;
  font-size: 15px;
  letter-spacing: 0;
}

.lyrics-select-control,
.setting-toggle {
  display: grid;
  gap: 8px;
}

.lyrics-select-control select {
  width: min(360px, 100%);
  height: 38px;
  border: 1px solid #d8d8df;
  border-radius: 10px;
  padding: 0 12px;
  color: #1d1d1f;
  background: white;
  font: inherit;
}

.setting-toggle {
  grid-template-columns: auto 1fr;
  align-items: center;
  width: fit-content;
  color: #1d1d1f;
}

.desktop-lyrics-preview {
  width: min(520px, 100%);
  padding: 16px 20px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 18px;
  color: white;
  background: rgba(14, 16, 20, 0.72);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.18);
}

.desktop-lyrics-preview p,
.desktop-lyrics-preview span {
  margin: 0;
  line-height: 1.18;
  overflow-wrap: anywhere;
}

.desktop-lyrics-preview p {
  font-weight: 760;
}

.desktop-lyrics-preview span {
  display: block;
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.56);
  font-size: 0.68em;
}
```

- [ ] **Step 4: Add fullscreen and desktop lyrics CSS**

In `.fullscreen-lyric-line`, add:

```css
  font-family: var(--fullscreen-lyrics-font-family, ui-sans-serif, system-ui, sans-serif);
```

In `.fullscreen-lyrics-empty`, add:

```css
  font-family: var(--fullscreen-lyrics-font-family, ui-sans-serif, system-ui, sans-serif);
```

Add these desktop lyrics styles near the fullscreen lyrics block:

```css
.desktop-lyrics-shell {
  width: 100vw;
  height: 100vh;
  display: grid;
  align-content: center;
  gap: 8px;
  padding: 18px 22px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 18px;
  color: white;
  background: rgba(14, 16, 20, 0.58);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(18px);
  font-family: var(--desktop-lyrics-font-family, ui-sans-serif, system-ui, sans-serif);
  -webkit-app-region: drag;
  overflow: hidden;
}

.desktop-lyrics-controls {
  position: fixed;
  top: 8px;
  right: 10px;
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 160ms ease;
  -webkit-app-region: no-drag;
}

.desktop-lyrics-shell:hover .desktop-lyrics-controls {
  opacity: 1;
}

.desktop-lyrics-control {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 999px;
  color: white;
  background: rgba(255, 255, 255, 0.16);
  -webkit-app-region: no-drag;
}

.desktop-lyrics-current,
.desktop-lyrics-next {
  margin: 0;
  line-height: 1.18;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desktop-lyrics-current {
  font-size: var(--desktop-lyrics-font-size, 28px);
  font-weight: 760;
}

.desktop-lyrics-current.loading {
  color: rgba(255, 255, 255, 0.72);
}

.desktop-lyrics-next {
  color: rgba(255, 255, 255, 0.56);
  font-size: calc(var(--desktop-lyrics-font-size, 28px) * 0.68);
}
```

- [ ] **Step 5: Run style tests**

Run:

```bash
npm test -- src/renderer/styles.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit styles**

Run:

```bash
git add src/renderer/styles.css src/renderer/styles.test.ts
git commit -m "style: add desktop lyrics styling"
```

---

### Task 10: Final Verification And Build

**Files:**
- No source files unless verification exposes a defect.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- src/renderer/appSettings.test.ts src/renderer/lyrics.test.ts src/renderer/components/FullscreenLyrics.test.tsx src/renderer/components/DesktopLyrics.test.tsx src/renderer/DesktopLyricsWindow.test.tsx src/renderer/components/SettingsPage.test.tsx src/renderer/App.test.tsx src/main/systemFonts.test.ts scripts/electron-preload.test.ts scripts/electron-desktop-lyrics.test.ts src/renderer/styles.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: PASS and Vite builds `dist/`; Electron TypeScript builds `dist-electron/`.

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intended source/test changes are present. Existing unrelated `build/app-icon.*` changes may still appear if they were present before execution; do not stage or revert them.

- [ ] **Step 6: Commit verification fixes only when a verification command required a code change**

If Step 1 through Step 4 required a code change, run `git status --short`, identify the files changed by that verification fix, and commit only those files with a specific message that names the fix. Use this exact commit message when the fix is only for the desktop lyrics integration:

```bash
git commit -m "fix: stabilize desktop lyrics integration"
```

If no fixes were needed, do not create an empty commit.

---

## Plan Self-Review

- Spec coverage: settings migration, independent fullscreen and desktop fonts, system font list, desktop lyrics window, renderer mode, IPC, close synchronization, styling, and tests each map to one or more tasks.
- Placeholder scan: this plan contains no incomplete future-work steps.
- Type consistency: `DesktopLyricsPayload`, `desktopLyricsEnabled`, `fullscreenLyricsFontFamily`, `desktopLyricsFontFamily`, and preload API names are consistent across tasks.
