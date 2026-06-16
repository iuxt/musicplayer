# Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app Settings page with library cache controls, non-interactive playback copy, and a persisted fullscreen lyrics font-size setting.

**Architecture:** Keep the app as a single React view tree and add a top-level `activeView` state for `"library"` versus `"settings"`. Store user settings in a small renderer utility so parsing, bounds checks, and persistence are testable outside `App.tsx`. Keep Settings UI in a focused component that receives all behavior through props.

**Tech Stack:** Electron, Vite, React 19, TypeScript, Vitest, Testing Library, `localStorage`, `lucide-react`.

---

## File Structure

- Create `src/renderer/appSettings.ts`: owns settings constants, default settings, storage read/write, and validation.
- Create `src/renderer/appSettings.test.ts`: verifies default handling, invalid persisted values, valid persisted values, and writes.
- Create `src/renderer/components/SettingsPage.tsx`: renders Library, Playback, and Lyrics settings sections from props.
- Create `src/renderer/components/SettingsPage.test.tsx`: verifies Settings UI actions, disabled state, status/error rendering, and font-size slider behavior.
- Modify `src/renderer/components/FullscreenLyrics.tsx`: accept `fullscreenLyricsFontSize` and scope it to the fullscreen lyrics region.
- Modify `src/renderer/components/FullscreenLyrics.test.tsx`: pass the new prop and assert the CSS variable is applied.
- Modify `src/renderer/components/Sidebar.tsx`: add Settings entry at the bottom and let category clicks return to the library view.
- Modify `src/renderer/App.tsx`: add active view state, settings state, cache-clear callback, settings persistence, and SettingsPage rendering.
- Modify `src/renderer/App.test.tsx`: add integration tests for Settings navigation, cache clearing, persisted font size, and invalid setting fallback.
- Modify `src/renderer/styles.css`: add Settings page styles and replace hard-coded fullscreen lyrics font sizing with the scoped CSS variable.

---

### Task 1: Settings Storage Utility

**Files:**
- Create: `src/renderer/appSettings.ts`
- Create: `src/renderer/appSettings.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/renderer/appSettings.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  APP_SETTINGS_STORAGE_KEY,
  DEFAULT_APP_SETTINGS,
  MAX_FULLSCREEN_LYRICS_FONT_SIZE,
  MIN_FULLSCREEN_LYRICS_FONT_SIZE,
  readAppSettings,
  writeAppSettings
} from "./appSettings";

describe("appSettings", () => {
  it("returns defaults when no settings are saved", () => {
    const storage = makeStorage();

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
  });

  it("reads a valid persisted fullscreen lyrics font size", () => {
    const storage = makeStorage({
      [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({ fullscreenLyricsFontSize: MAX_FULLSCREEN_LYRICS_FONT_SIZE })
    });

    expect(readAppSettings(storage)).toEqual({ fullscreenLyricsFontSize: MAX_FULLSCREEN_LYRICS_FONT_SIZE });
  });

  it("writes normalized settings", () => {
    const storage = makeStorage();

    writeAppSettings({ fullscreenLyricsFontSize: MIN_FULLSCREEN_LYRICS_FONT_SIZE }, storage);

    expect(storage.setItem).toHaveBeenCalledWith(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({ fullscreenLyricsFontSize: MIN_FULLSCREEN_LYRICS_FONT_SIZE })
    );
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

- [ ] **Step 2: Run the new tests and verify they fail**

Run:

```bash
npm test -- src/renderer/appSettings.test.ts
```

Expected: FAIL because `src/renderer/appSettings.ts` does not exist.

- [ ] **Step 3: Implement the settings utility**

Create `src/renderer/appSettings.ts`:

```ts
export const APP_SETTINGS_STORAGE_KEY = "local-music-player:settings";
export const MIN_FULLSCREEN_LYRICS_FONT_SIZE = 24;
export const MAX_FULLSCREEN_LYRICS_FONT_SIZE = 56;

export interface AppSettings {
  fullscreenLyricsFontSize: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  fullscreenLyricsFontSize: 36
};

type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

export function readAppSettings(storage: SettingsStorage = localStorage): AppSettings {
  const savedValue = storage.getItem(APP_SETTINGS_STORAGE_KEY);
  if (!savedValue) {
    return DEFAULT_APP_SETTINGS;
  }

  try {
    return normalizeAppSettings(JSON.parse(savedValue) as unknown);
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function writeAppSettings(settings: AppSettings, storage: SettingsStorage = localStorage) {
  storage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeAppSettings(settings)));
}

export function normalizeAppSettings(value: unknown): AppSettings {
  if (!isRecord(value)) {
    return DEFAULT_APP_SETTINGS;
  }

  const fontSize = value.fullscreenLyricsFontSize;
  if (
    typeof fontSize !== "number" ||
    !Number.isFinite(fontSize) ||
    fontSize < MIN_FULLSCREEN_LYRICS_FONT_SIZE ||
    fontSize > MAX_FULLSCREEN_LYRICS_FONT_SIZE
  ) {
    return DEFAULT_APP_SETTINGS;
  }

  return {
    fullscreenLyricsFontSize: Math.round(fontSize)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
```

- [ ] **Step 4: Run the utility tests and verify they pass**

Run:

```bash
npm test -- src/renderer/appSettings.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/appSettings.ts src/renderer/appSettings.test.ts
git commit -m "feat: add renderer settings storage"
```

---

### Task 2: Fullscreen Lyrics Font Size Prop

**Files:**
- Modify: `src/renderer/components/FullscreenLyrics.tsx`
- Modify: `src/renderer/components/FullscreenLyrics.test.tsx`
- Modify: `src/renderer/styles.css`

- [ ] **Step 1: Write the failing component test**

Update `src/renderer/components/FullscreenLyrics.test.tsx` so every render passes `fullscreenLyricsFontSize={36}`, and add this test:

```ts
  it("applies the configured fullscreen lyrics font size", () => {
    render(
      <FullscreenLyrics
        track={track}
        artworkUrl="file:///cover.jpg"
        lyrics={"[00:01.00]Custom size line"}
        isLyricsLoading={false}
        currentTime={2}
        fullscreenLyricsFontSize={48}
        onClose={() => undefined}
      />
    );

    const fullscreenLyrics = screen.getByRole("region", { name: "Fullscreen lyrics" });
    expect((fullscreenLyrics as HTMLElement).style.getPropertyValue("--fullscreen-lyrics-font-size")).toBe("48px");
  });
```

- [ ] **Step 2: Run the fullscreen lyrics tests and verify they fail**

Run:

```bash
npm test -- src/renderer/components/FullscreenLyrics.test.tsx
```

Expected: FAIL because `FullscreenLyrics` does not accept `fullscreenLyricsFontSize`.

- [ ] **Step 3: Add the prop and scoped CSS variable**

Update the import in `src/renderer/components/FullscreenLyrics.tsx`:

```ts
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
```

Update `FullscreenLyricsProps`:

```ts
interface FullscreenLyricsProps {
  track: Track | null;
  artworkUrl: string | null;
  lyrics: string | null;
  isLyricsLoading: boolean;
  currentTime: number;
  fullscreenLyricsFontSize: number;
  onClose: () => void;
}
```

Update the component signature and add the style object:

```ts
export function FullscreenLyrics({
  track,
  artworkUrl,
  lyrics,
  isLyricsLoading,
  currentTime,
  fullscreenLyricsFontSize,
  onClose
}: FullscreenLyricsProps) {
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const lines = useMemo(() => parseLyrics(lyrics), [lyrics]);
  const activeIndex = useMemo(() => findActiveLine(lines, currentTime), [currentTime, lines]);
  const lyricsStyle = {
    "--fullscreen-lyrics-font-size": `${fullscreenLyricsFontSize}px`
  } as CSSProperties & Record<"--fullscreen-lyrics-font-size", string>;
```

Update the `<section>` opening tag:

```tsx
    <section className="fullscreen-lyrics" aria-label="Fullscreen lyrics" style={lyricsStyle}>
```

Update `src/renderer/styles.css`:

```css
.fullscreen-lyric-line {
  color: rgba(255, 255, 255, 0.38);
  font-size: var(--fullscreen-lyrics-font-size, 36px);
  font-weight: 750;
  line-height: 1.16;
  overflow-wrap: anywhere;
  transition: color 180ms ease, transform 180ms ease, opacity 180ms ease;
}

.fullscreen-lyrics-empty {
  margin: 0;
  color: rgba(255, 255, 255, 0.56);
  font-size: var(--fullscreen-lyrics-font-size, 36px);
  font-weight: 750;
}
```

- [ ] **Step 4: Run the focused tests and verify they pass**

Run:

```bash
npm test -- src/renderer/components/FullscreenLyrics.test.tsx src/renderer/styles.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/FullscreenLyrics.tsx src/renderer/components/FullscreenLyrics.test.tsx src/renderer/styles.css
git commit -m "feat: support fullscreen lyrics font sizing"
```

---

### Task 3: Settings Page Component

**Files:**
- Create: `src/renderer/components/SettingsPage.tsx`
- Create: `src/renderer/components/SettingsPage.test.tsx`

- [ ] **Step 1: Write the failing SettingsPage tests**

Create `src/renderer/components/SettingsPage.test.tsx`:

```ts
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  it("renders library actions and disables rescan without a folder", () => {
    const props = makeProps({ folderPath: null });

    render(<SettingsPage {...props} />);

    expect(screen.getByRole("region", { name: "Settings" })).toBeTruthy();
    expect(screen.getByText("No music folder selected.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Rescan Library" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls library action callbacks", () => {
    const props = makeProps({ folderPath: "/Users/test/Music" });

    render(<SettingsPage {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose Folder" }));
    fireEvent.click(screen.getByRole("button", { name: "Rescan Library" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear Library Cache" }));

    expect(props.onChooseFolder).toHaveBeenCalled();
    expect(props.onRescanLibrary).toHaveBeenCalled();
    expect(props.onClearLibraryCache).toHaveBeenCalled();
  });

  it("shows cache status and cache error messages", () => {
    render(
      <SettingsPage
        {...makeProps({
          cacheStatus: "Library cache cleared.",
          cacheError: "Unable to clear the library cache."
        })}
      />
    );

    expect(screen.getByText("Library cache cleared.")).toBeTruthy();
    expect(screen.getByText("Unable to clear the library cache.")).toBeTruthy();
  });

  it("changes fullscreen lyrics font size", () => {
    const props = makeProps({ fullscreenLyricsFontSize: 36 });

    render(<SettingsPage {...props} />);
    fireEvent.change(screen.getByLabelText("Fullscreen lyrics font size"), { target: { value: "48" } });

    expect(props.onFullscreenLyricsFontSizeChange).toHaveBeenCalledWith(48);
    expect(screen.getByText("36px")).toBeTruthy();
    expect(screen.getByText("Lyrics preview line")).toBeTruthy();
  });
});

function makeProps(overrides: Partial<Parameters<typeof SettingsPage>[0]> = {}): Parameters<typeof SettingsPage>[0] {
  return {
    folderPath: "/Users/test/Music",
    isScanning: false,
    fullscreenLyricsFontSize: 36,
    cacheStatus: null,
    cacheError: null,
    onChooseFolder: vi.fn(),
    onRescanLibrary: vi.fn(),
    onClearLibraryCache: vi.fn(),
    onFullscreenLyricsFontSizeChange: vi.fn(),
    ...overrides
  };
}
```

- [ ] **Step 2: Run the SettingsPage tests and verify they fail**

Run:

```bash
npm test -- src/renderer/components/SettingsPage.test.tsx
```

Expected: FAIL because `SettingsPage` does not exist.

- [ ] **Step 3: Implement SettingsPage**

Create `src/renderer/components/SettingsPage.tsx`:

```tsx
import { FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import {
  MAX_FULLSCREEN_LYRICS_FONT_SIZE,
  MIN_FULLSCREEN_LYRICS_FONT_SIZE
} from "../appSettings";

interface SettingsPageProps {
  folderPath: string | null;
  isScanning: boolean;
  fullscreenLyricsFontSize: number;
  cacheStatus: string | null;
  cacheError: string | null;
  onChooseFolder: () => void;
  onRescanLibrary: () => void;
  onClearLibraryCache: () => void;
  onFullscreenLyricsFontSizeChange: (fontSize: number) => void;
}

export function SettingsPage({
  folderPath,
  isScanning,
  fullscreenLyricsFontSize,
  cacheStatus,
  cacheError,
  onChooseFolder,
  onRescanLibrary,
  onClearLibraryCache,
  onFullscreenLyricsFontSizeChange
}: SettingsPageProps) {
  return (
    <section className="settings-page" aria-label="Settings">
      <div className="settings-header">
        <p className="eyebrow">Settings</p>
        <h2>Settings</h2>
      </div>

      <section className="settings-section" aria-labelledby="library-settings-heading">
        <div className="settings-section-heading">
          <h3 id="library-settings-heading">Library</h3>
          <p>Manage the local folder and cached library scan.</p>
        </div>
        <div className="setting-row">
          <div>
            <strong>Music folder</strong>
            <p className="settings-path">{folderPath ?? "No music folder selected."}</p>
          </div>
        </div>
        <div className="settings-actions">
          <button className="primary-button" onClick={onChooseFolder} type="button">
            <FolderOpen size={16} />
            Choose Folder
          </button>
          <button className="secondary-button" disabled={!folderPath || isScanning} onClick={onRescanLibrary} type="button">
            <RefreshCw size={16} />
            Rescan Library
          </button>
          <button className="secondary-button" onClick={onClearLibraryCache} type="button">
            <Trash2 size={16} />
            Clear Library Cache
          </button>
        </div>
        {cacheStatus ? <p className="settings-status">{cacheStatus}</p> : null}
        {cacheError ? <p className="settings-error">{cacheError}</p> : null}
      </section>

      <section className="settings-section" aria-labelledby="playback-settings-heading">
        <div className="settings-section-heading">
          <h3 id="playback-settings-heading">Playback</h3>
          <p>Playback preferences will appear here.</p>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="lyrics-settings-heading">
        <div className="settings-section-heading">
          <h3 id="lyrics-settings-heading">Lyrics</h3>
          <p>Adjust fullscreen lyrics readability without changing the rest of the app.</p>
        </div>
        <label className="lyrics-size-control">
          <span>Fullscreen lyrics font size</span>
          <strong>{fullscreenLyricsFontSize}px</strong>
          <input
            aria-label="Fullscreen lyrics font size"
            max={MAX_FULLSCREEN_LYRICS_FONT_SIZE}
            min={MIN_FULLSCREEN_LYRICS_FONT_SIZE}
            onChange={(event) => onFullscreenLyricsFontSizeChange(Number(event.target.value))}
            step="1"
            type="range"
            value={fullscreenLyricsFontSize}
          />
        </label>
        <p className="lyrics-preview" style={{ fontSize: `${fullscreenLyricsFontSize}px` }}>
          Lyrics preview line
        </p>
      </section>
    </section>
  );
}
```

- [ ] **Step 4: Run the component tests and verify they pass**

Run:

```bash
npm test -- src/renderer/components/SettingsPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/SettingsPage.tsx src/renderer/components/SettingsPage.test.tsx
git commit -m "feat: add settings page component"
```

---

### Task 4: App and Sidebar Integration

**Files:**
- Modify: `src/renderer/components/Sidebar.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/App.test.tsx`

- [ ] **Step 1: Write the failing App integration tests**

Add this constant near the existing storage-key constants in `src/renderer/App.test.tsx`:

```ts
const appSettingsKey = "local-music-player:settings";
```

Add these tests before the closing `});` of `describe("App", () => { ... })`:

```ts
  it("opens settings from the sidebar and returns to the library from a category", async () => {
    localStorage.setItem("local-music-player:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByRole("region", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("contentinfo")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Albums" }));

    expect(await screen.findByRole("heading", { name: "Albums" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Settings" })).toBeNull();
  });

  it("clears only the library cache from settings", async () => {
    localStorage.setItem("local-music-player:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    localStorage.setItem(
      playbackStateKey,
      JSON.stringify({
        trackId: track.id,
        currentTime: 12,
        queueTrackIds: [track.id],
        isPlayQueueExplicit: true,
        playlistLabel: "Library"
      })
    );

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear Library Cache" }));

    expect(localStorage.getItem(libraryCacheKey)).toBeNull();
    expect(localStorage.getItem("local-music-player:last-folder")).toBe(rememberedFolder);
    expect(localStorage.getItem(playbackStateKey)).not.toBeNull();
    expect(screen.getByText("Library cache cleared.")).toBeTruthy();
  });

  it("persists fullscreen lyrics font size and applies it to fullscreen lyrics", async () => {
    const trackWithLyrics = { ...track, lyricsPath: "/music/Wave Song.lrc", hasLyrics: true };
    localStorage.setItem("local-music-player:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify({ ...scanResult, tracks: [trackWithLyrics] }));
    window.musicApi.getLyrics = vi.fn(async () => "[00:00.00]Preview lyric");

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("Fullscreen lyrics font size"), { target: { value: "48" } });

    expect(JSON.parse(localStorage.getItem(appSettingsKey) ?? "{}")).toEqual({ fullscreenLyricsFontSize: 48 });

    fireEvent.click(screen.getByRole("button", { name: "Songs" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Open fullscreen lyrics" }));

    expect(await screen.findByText("Preview lyric")).toBeTruthy();
    const fullscreenLyrics = screen.getByRole("region", { name: "Fullscreen lyrics" });
    expect((fullscreenLyrics as HTMLElement).style.getPropertyValue("--fullscreen-lyrics-font-size")).toBe("48px");
  });

  it("falls back to the default fullscreen lyrics font size when saved settings are invalid", () => {
    localStorage.setItem(appSettingsKey, JSON.stringify({ fullscreenLyricsFontSize: 72 }));

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect((screen.getByLabelText("Fullscreen lyrics font size") as HTMLInputElement).value).toBe("36");
  });
```

- [ ] **Step 2: Run the App tests and verify they fail**

Run:

```bash
npm test -- src/renderer/App.test.tsx
```

Expected: FAIL because the Sidebar has no Settings entry and App does not render SettingsPage.

- [ ] **Step 3: Update Sidebar**

Update imports in `src/renderer/components/Sidebar.tsx`:

```ts
import { Disc3, Folder, ListMusic, Mic2, Music2, Settings } from "lucide-react";
```

Update props:

```ts
interface SidebarProps {
  folderPath: string | null;
  trackCount: number;
  activeCategory: LibraryCategory;
  activeView: "library" | "settings";
  onCategoryChange: (category: LibraryCategory) => void;
  onSettingsOpen: () => void;
}
```

Update the component signature:

```tsx
export function Sidebar({
  folderPath,
  trackCount,
  activeCategory,
  activeView,
  onCategoryChange,
  onSettingsOpen
}: SidebarProps) {
```

Replace the bottom folder-path render with a footer that contains Settings and the path:

```tsx
      <div className="sidebar-footer">
        <button
          className={`nav-item ${activeView === "settings" ? "active" : ""}`}
          onClick={onSettingsOpen}
          type="button"
        >
          <Settings size={18} />
          Settings
        </button>

        {folderPath ? <p className="folder-path">{folderPath}</p> : null}
      </div>
```

Keep category buttons using `activeCategory` for their active state.

- [ ] **Step 4: Update App**

Add imports in `src/renderer/App.tsx`:

```ts
import {
  type AppSettings,
  normalizeAppSettings,
  readAppSettings,
  writeAppSettings
} from "./appSettings";
import { SettingsPage } from "./components/SettingsPage";
```

Add a view type near `PlaybackState`:

```ts
type AppView = "library" | "settings";
```

Add state near the existing UI state:

```ts
  const [activeView, setActiveView] = useState<AppView>("library");
  const [appSettings, setAppSettings] = useState<AppSettings>(() => readAppSettings());
  const [cacheStatus, setCacheStatus] = useState<string | null>(null);
  const [cacheError, setCacheError] = useState<string | null>(null);
```

Update `changeCategory`:

```ts
  const changeCategory = useCallback((category: LibraryCategory) => {
    setActiveView("library");
    setActiveCategory(category);
    if (category !== "folders") {
      setSelectedFolderPath(null);
    }
  }, []);
```

Add settings callbacks near the other callbacks:

```ts
  const openSettings = useCallback(() => {
    setActiveView("settings");
    setCacheStatus(null);
    setCacheError(null);
  }, []);

  const clearLibraryCache = useCallback(() => {
    setCacheStatus(null);
    setCacheError(null);
    try {
      localStorage.removeItem(LIBRARY_CACHE_STORAGE_KEY);
      setCacheStatus("Library cache cleared.");
    } catch {
      setCacheError("Unable to clear the library cache.");
    }
  }, []);

  const changeFullscreenLyricsFontSize = useCallback((fontSize: number) => {
    const nextSettings = normalizeAppSettings({ fullscreenLyricsFontSize: fontSize });
    setAppSettings(nextSettings);
    try {
      writeAppSettings(nextSettings);
    } catch {
      setAppError("Unable to save settings.");
    }
  }, []);
```

Update the `Sidebar` usage:

```tsx
      <Sidebar
        folderPath={folderPath}
        trackCount={tracks.length}
        activeCategory={activeCategory}
        activeView={activeView}
        onCategoryChange={changeCategory}
        onSettingsOpen={openSettings}
      />
```

Replace the library-only main-stage branch with a settings-aware branch:

```tsx
        {activeView === "settings" ? (
          <SettingsPage
            folderPath={folderPath}
            isScanning={isScanning}
            fullscreenLyricsFontSize={appSettings.fullscreenLyricsFontSize}
            cacheStatus={cacheStatus}
            cacheError={cacheError}
            onChooseFolder={chooseFolder}
            onRescanLibrary={rescan}
            onClearLibraryCache={clearLibraryCache}
            onFullscreenLyricsFontSizeChange={changeFullscreenLyricsFontSize}
          />
        ) : tracks.length === 0 ? (
          <EmptyState onChooseFolder={chooseFolder} isScanning={isScanning} />
        ) : (
          <div className="library-workspace">
            <LibraryList
              category={activeCategory}
              tracks={visibleTracks}
              currentTrack={player.currentTrack}
              search={search}
              selectedFolderPath={selectedFolderPath}
              onSearchChange={setSearch}
              onSelectTrack={playTrack}
              onOpenFolder={openFolder}
              onBackToFolders={backFolder}
              onTrackContextMenu={(track, position) => setTrackMenu({ track, position })}
            />
            <Playlist
              tracks={playlistTracks}
              currentTrack={player.currentTrack}
              label={playlistLabel}
              onSelectTrack={selectPlaylistTrack}
              onClear={clearPlaylist}
              onRemoveTrack={removePlaylistTrack}
            />
          </div>
        )}
```

Update `FullscreenLyrics` usage:

```tsx
        <FullscreenLyrics
          track={player.currentTrack}
          artworkUrl={artworkUrl}
          lyrics={lyrics}
          isLyricsLoading={isLyricsLoading}
          currentTime={player.currentTime}
          fullscreenLyricsFontSize={appSettings.fullscreenLyricsFontSize}
          onClose={() => setIsFullscreenLyricsOpen(false)}
        />
```

- [ ] **Step 5: Run the App tests and verify they pass**

Run:

```bash
npm test -- src/renderer/App.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Sidebar.tsx src/renderer/App.tsx src/renderer/App.test.tsx
git commit -m "feat: wire settings page into app"
```

---

### Task 5: Settings Styles and Full Verification

**Files:**
- Modify: `src/renderer/styles.css`

- [ ] **Step 1: Add Settings page styles**

Add these rules to `src/renderer/styles.css` near the existing panel styles:

```css
.sidebar-footer {
  margin-top: auto;
  display: grid;
  gap: 12px;
}

.settings-page {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  gap: 18px;
  align-content: start;
}

.settings-header h2 {
  margin: 0;
  font-size: 34px;
  letter-spacing: 0;
}

.settings-section {
  display: grid;
  gap: 16px;
  padding: 22px;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.06);
}

.settings-section-heading {
  display: grid;
  gap: 6px;
}

.settings-section-heading h3 {
  margin: 0;
  font-size: 20px;
  letter-spacing: 0;
}

.settings-section-heading p,
.settings-path,
.settings-status,
.settings-error {
  margin: 0;
  font-size: 13px;
}

.setting-row {
  display: grid;
  gap: 8px;
}

.setting-row strong,
.lyrics-size-control span {
  color: #1d1d1f;
}

.settings-path {
  margin-top: 6px;
  overflow-wrap: anywhere;
}

.settings-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.settings-actions .primary-button,
.settings-actions .secondary-button {
  width: auto;
  height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
}

.settings-status {
  color: #047857;
}

.settings-error {
  color: #d70015;
}

.lyrics-size-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.lyrics-size-control input {
  grid-column: 1 / -1;
  width: 100%;
}

.lyrics-preview {
  margin: 0;
  color: #1d1d1f;
  line-height: 1.16;
  overflow-wrap: anywhere;
}
```

Update the existing `.folder-path` rule only if needed so it no longer relies on being a direct flex child of `.sidebar`; keep `overflow-wrap: anywhere` and `line-height: 1.4`.

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm test -- src/renderer/appSettings.test.ts src/renderer/components/SettingsPage.test.tsx src/renderer/components/FullscreenLyrics.test.tsx src/renderer/App.test.tsx src/renderer/styles.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit verification-ready styles**

```bash
git add src/renderer/styles.css
git commit -m "style: add settings page layout"
```

If `src/renderer/styles.css` was already committed in Task 2 and no style changes remain, run:

```bash
git status --short
```

Expected: no unstaged `src/renderer/styles.css` changes.

---

## Self-Review

- Spec coverage: Task 1 covers localStorage settings persistence and validation. Task 2 covers fullscreen lyrics font size scoping. Task 3 covers Settings page content. Task 4 covers sidebar navigation, cache clearing, and App wiring. Task 5 covers visual styling and full verification.
- Scope check: The plan does not add routing, playback controls, file mutation, or global text scaling.
- Type consistency: `fullscreenLyricsFontSize`, `SettingsPage`, `APP_SETTINGS_STORAGE_KEY`, `readAppSettings`, `writeAppSettings`, and `normalizeAppSettings` use the same names across tests and implementation steps.
