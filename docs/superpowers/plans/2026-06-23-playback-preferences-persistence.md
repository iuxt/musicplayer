# Playback Preferences Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist volume, shuffle, and repeat mode across app restarts.

**Architecture:** Extend the existing renderer settings model and keep all `localStorage` writes in `App.tsx` through `commitAppSettings`. `useAudioPlayer` accepts initial playback preferences and returns the normalized next values when volume or playback mode changes, while remaining storage-agnostic.

**Tech Stack:** Electron, Vite, React 19, TypeScript, Vitest, Testing Library, `localStorage`.

---

## File Structure

- Modify `src/renderer/appSettings.ts`: add playback preference fields, defaults, validation, and normalization.
- Modify `src/renderer/appSettings.test.ts`: cover reading, writing, migration, and invalid persisted playback preferences.
- Modify `src/renderer/hooks/useAudioPlayer.ts`: accept initial `volume`, `shuffle`, and `repeat`; return normalized next values from preference mutators.
- Modify `src/renderer/hooks/useAudioPlayer.test.tsx`: cover initial preferences and retained playback-mode cycle behavior.
- Modify `src/renderer/App.tsx`: pass saved preferences into `useAudioPlayer`, wrap volume and playback mode handlers, and persist changes through existing settings commits.
- Modify `src/renderer/App.test.tsx`: cover startup restoration and persistence from the visible controls.

## Task 1: Settings Model

**Files:**
- Modify: `src/renderer/appSettings.ts`
- Modify: `src/renderer/appSettings.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests to `src/renderer/appSettings.test.ts`:

```ts
it("reads and writes playback preferences", () => {
  const storage = makeStorage({
    [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
      ...DEFAULT_APP_SETTINGS,
      volume: 0.42,
      shuffle: true,
      repeat: "all"
    })
  });

  expect(readAppSettings(storage)).toEqual({
    ...DEFAULT_APP_SETTINGS,
    volume: 0.42,
    shuffle: true,
    repeat: "all"
  });

  writeAppSettings({ ...DEFAULT_APP_SETTINGS, volume: 0.64, shuffle: false, repeat: "one" }, storage);

  expect(storage.setItem).toHaveBeenCalledWith(
    APP_SETTINGS_STORAGE_KEY,
    JSON.stringify({ ...DEFAULT_APP_SETTINGS, volume: 0.64, shuffle: false, repeat: "one" })
  );
});

it("fills missing playback preferences with defaults for legacy settings", () => {
  const storage = makeStorage({
    [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
      fullscreenLyricsFontFamily: "",
      fullscreenLyricsFontSize: 36,
      systemMediaShortcutsEnabled: false,
      closeWindowStopsPlayback: false,
      desktopLyricsEnabled: false,
      desktopLyricsFontFamily: "",
      desktopLyricsFontSize: 28
    })
  });

  expect(readAppSettings(storage)).toEqual(DEFAULT_APP_SETTINGS);
});

it("returns defaults for invalid persisted playback preferences", () => {
  expect(
    readAppSettings(makeStorage({ [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({ ...DEFAULT_APP_SETTINGS, volume: 2 }) }))
  ).toEqual(DEFAULT_APP_SETTINGS);
  expect(
    readAppSettings(makeStorage({ [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({ ...DEFAULT_APP_SETTINGS, shuffle: "yes" }) }))
  ).toEqual(DEFAULT_APP_SETTINGS);
  expect(
    readAppSettings(makeStorage({ [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({ ...DEFAULT_APP_SETTINGS, repeat: "repeat" }) }))
  ).toEqual(DEFAULT_APP_SETTINGS);
});
```

Update exact object assertions for `DEFAULT_APP_SETTINGS` to include:

```ts
volume: 0.82,
shuffle: false,
repeat: "off"
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- src/renderer/appSettings.test.ts
```

Expected: FAIL because `volume`, `shuffle`, and `repeat` do not exist in `AppSettings`.

- [ ] **Step 3: Implement settings fields**

In `src/renderer/appSettings.ts`, add:

```ts
export type RepeatMode = "off" | "all" | "one";
export const DEFAULT_VOLUME = 0.82;

export interface AppSettings {
  fullscreenLyricsFontFamily: string;
  fullscreenLyricsFontSize: number;
  systemMediaShortcutsEnabled: boolean;
  closeWindowStopsPlayback: boolean;
  desktopLyricsEnabled: boolean;
  desktopLyricsFontFamily: string;
  desktopLyricsFontSize: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
}
```

Extend `DEFAULT_APP_SETTINGS`:

```ts
volume: DEFAULT_VOLUME,
shuffle: false,
repeat: "off"
```

In `normalizeAppSettings`, read and validate:

```ts
const volumeValue = getValueOrDefault(value, "volume", DEFAULT_APP_SETTINGS.volume);
const shuffle = getValueOrDefault(value, "shuffle", DEFAULT_APP_SETTINGS.shuffle);
const repeat = getValueOrDefault(value, "repeat", DEFAULT_APP_SETTINGS.repeat);
const volume = normalizeVolume(volumeValue);
```

Add those fields to the invalid-type guard:

```ts
volume === null ||
typeof shuffle !== "boolean" ||
!isRepeatMode(repeat)
```

Return them in the normalized object:

```ts
volume,
shuffle,
repeat
```

Add helpers:

```ts
function normalizeVolume(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    return null;
  }

  return value;
}

function isRepeatMode(value: unknown): value is RepeatMode {
  return value === "off" || value === "all" || value === "one";
}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```bash
npm test -- src/renderer/appSettings.test.ts
```

Expected: PASS.

## Task 2: Audio Player Initial Preferences

**Files:**
- Modify: `src/renderer/hooks/useAudioPlayer.ts`
- Modify: `src/renderer/hooks/useAudioPlayer.test.tsx`
- Modify: `src/renderer/components/PlayerBar.tsx`

- [ ] **Step 1: Write failing hook tests**

Add to `src/renderer/hooks/useAudioPlayer.test.tsx`:

```ts
it("initializes playback preferences from saved values", () => {
  const { result } = renderHook(() => useAudioPlayer(tracks, { volume: 0.35, shuffle: true, repeat: "all" }));

  expect(result.current.volume).toBe(0.35);
  expect(result.current.shuffle).toBe(true);
  expect(result.current.repeat).toBe("all");
  expect(createdAudioElements[0].volume).toBe(0.35);
});

it("returns normalized values when mutating playback preferences", () => {
  const { result } = renderHook(() => useAudioPlayer(tracks, { volume: 0.35, shuffle: false, repeat: "off" }));

  act(() => {
    expect(result.current.setVolume(2)).toBe(1);
  });
  expect(result.current.volume).toBe(1);

  act(() => {
    expect(result.current.cyclePlaybackMode()).toEqual({ shuffle: true, repeat: "off" });
  });
  expect(result.current.shuffle).toBe(true);
  expect(result.current.repeat).toBe("off");
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- src/renderer/hooks/useAudioPlayer.test.tsx
```

Expected: FAIL because `useAudioPlayer` does not accept initial preferences and mutators return `void`.

- [ ] **Step 3: Implement hook preferences**

In `src/renderer/hooks/useAudioPlayer.ts`, import the settings repeat type:

```ts
import type { RepeatMode } from "../appSettings";
```

Replace the local repeat type with:

```ts
export interface PlaybackPreferences {
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
}

const DEFAULT_PLAYBACK_PREFERENCES: PlaybackPreferences = {
  volume: 0.82,
  shuffle: false,
  repeat: "off"
};

export function useAudioPlayer(queue: Track[], initialPreferences: PlaybackPreferences = DEFAULT_PLAYBACK_PREFERENCES) {
```

Initialize state from `initialPreferences`:

```ts
const [volume, setVolumeState] = useState(() => clampVolume(initialPreferences.volume));
const [shuffle, setShuffle] = useState(initialPreferences.shuffle);
const [repeat, setRepeat] = useState<RepeatMode>(initialPreferences.repeat);
```

Make `setVolume` return the clamped value:

```ts
const setVolume = useCallback((nextVolume: number) => {
  const clamped = clampVolume(nextVolume);
  if (audioRef.current) {
    audioRef.current.volume = clamped;
  }
  setVolumeState(clamped);
  return clamped;
}, []);
```

Make playback mode cycling return the next state:

```ts
const cyclePlaybackMode = useCallback(() => {
  const nextMode =
    shuffle ? { shuffle: false, repeat: "all" as const }
    : repeat === "off" ? { shuffle: true, repeat: "off" as const }
    : repeat === "all" ? { shuffle: false, repeat: "one" as const }
    : { shuffle: false, repeat: "off" as const };

  setShuffle(nextMode.shuffle);
  setRepeat(nextMode.repeat);
  return nextMode;
}, [repeat, shuffle]);
```

Add:

```ts
function clampVolume(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : DEFAULT_PLAYBACK_PREFERENCES.volume));
}
```

Update `PlayerBar.tsx` to import `RepeatMode` from `../appSettings`.

- [ ] **Step 4: Run tests and verify pass**

Run:

```bash
npm test -- src/renderer/hooks/useAudioPlayer.test.tsx src/renderer/components/PlayerBar.test.tsx
```

Expected: PASS.

## Task 3: App Persistence Wiring

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/App.test.tsx`

- [ ] **Step 1: Write failing app tests**

Add to `src/renderer/App.test.tsx`:

```ts
it("restores saved volume into the player", async () => {
  localStorage.setItem("musicplayer:last-folder", rememberedFolder);
  localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
  localStorage.setItem(appSettingsKey, JSON.stringify({ ...defaultStoredSettings(), volume: 0.35 }));

  render(<App />);

  await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
  expect((screen.getByLabelText("音量") as HTMLInputElement).value).toBe("0.35");
  expect(createdAudioElements[0].volume).toBe(0.35);
});

it("persists volume changes", async () => {
  localStorage.setItem("musicplayer:last-folder", rememberedFolder);
  localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

  render(<App />);

  await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
  fireEvent.change(screen.getByLabelText("音量"), { target: { value: "0.44" } });

  expect(JSON.parse(localStorage.getItem(appSettingsKey) ?? "{}")).toMatchObject({ volume: 0.44 });
  expect(createdAudioElements[0].volume).toBe(0.44);
});

it("restores saved playback mode", async () => {
  localStorage.setItem("musicplayer:last-folder", rememberedFolder);
  localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
  localStorage.setItem(appSettingsKey, JSON.stringify({ ...defaultStoredSettings(), shuffle: true, repeat: "off" }));

  render(<App />);

  await waitFor(() => expect(screen.getByRole("button", { name: "播放模式：随机播放" })).toBeTruthy());
});

it("persists playback mode changes", async () => {
  localStorage.setItem("musicplayer:last-folder", rememberedFolder);
  localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));

  render(<App />);

  await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
  fireEvent.click(screen.getByRole("button", { name: "播放模式：关闭" }));

  expect(JSON.parse(localStorage.getItem(appSettingsKey) ?? "{}")).toMatchObject({ shuffle: true, repeat: "off" });

  fireEvent.click(screen.getByRole("button", { name: "播放模式：随机播放" }));

  expect(JSON.parse(localStorage.getItem(appSettingsKey) ?? "{}")).toMatchObject({ shuffle: false, repeat: "all" });
});
```

Update `defaultStoredSettings()` to include:

```ts
volume: 0.82,
shuffle: false,
repeat: "off"
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- src/renderer/App.test.tsx
```

Expected: FAIL because the app does not pass saved preferences into the player or persist player preference changes.

- [ ] **Step 3: Implement App wiring**

In `src/renderer/App.tsx`, pass initial preferences:

```ts
const player = useAudioPlayer(playlistTracks, {
  volume: appSettings.volume,
  shuffle: appSettings.shuffle,
  repeat: appSettings.repeat
});
```

Add handlers:

```ts
const changeVolume = useCallback(
  (volume: number) => {
    const nextVolume = player.setVolume(volume);
    commitAppSettings((currentSettings) => ({ ...currentSettings, volume: nextVolume }));
  },
  [commitAppSettings, player.setVolume]
);

const changePlaybackMode = useCallback(() => {
  const nextMode = player.cyclePlaybackMode();
  commitAppSettings((currentSettings) => ({ ...currentSettings, ...nextMode }));
}, [commitAppSettings, player.cyclePlaybackMode]);
```

Pass them to `PlayerBar`:

```tsx
onVolume={changeVolume}
onPlaybackMode={changePlaybackMode}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```bash
npm test -- src/renderer/App.test.tsx src/renderer/appSettings.test.ts src/renderer/hooks/useAudioPlayer.test.tsx
```

Expected: PASS.

## Task 4: Full Verification

**Files:**
- All touched source and test files.

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Review diff**

Run:

```bash
git diff --check
git diff -- src/renderer/appSettings.ts src/renderer/appSettings.test.ts src/renderer/hooks/useAudioPlayer.ts src/renderer/hooks/useAudioPlayer.test.tsx src/renderer/App.tsx src/renderer/App.test.tsx src/renderer/components/PlayerBar.tsx
```

Expected: no whitespace errors; diff only covers playback preference persistence.
