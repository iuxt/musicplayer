# Playback Position Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Restore the last played track and playback position on app startup while keeping playback paused.

**Architecture:** Keep persistence in renderer `localStorage`, beside the existing remembered-folder and library cache keys. `App.tsx` validates and applies a compact playback snapshot after a library result is loaded, while `useAudioPlayer` exposes a paused restore path that loads a track URL and sets the desired time without calling `play`.

**Tech Stack:** Electron, React, TypeScript, Vitest, Testing Library, browser `localStorage`, native `HTMLAudioElement`.

---

### Task 1: Add App-Level Restore Tests

**Files:**
- Modify: `src/renderer/App.test.tsx`

- [x] **Step 1: Write the failing startup restore test**

Add a `playbackStateKey` constant beside `libraryCacheKey`:

```ts
const playbackStateKey = "musicplayer:playback-state";
```

Add this test in the `App` describe block:

```ts
it("restores the last played track and position on startup without autoplaying", async () => {
  localStorage.setItem("musicplayer:last-folder", rememberedFolder);
  localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
  localStorage.setItem(
    playbackStateKey,
    JSON.stringify({
      trackId: secondTrack.id,
      currentTime: 42,
      queueTrackIds: [secondTrack.id, thirdTrack.id],
      isPlayQueueExplicit: true,
      playlistLabel: "Second Artist/Second Album"
    })
  );

  render(<App />);

  await waitFor(() => expect(window.musicApi.getPlayableUrl).toHaveBeenCalledWith(secondTrack.filePath));
  await waitFor(() => expect(screen.getByText("0:42")).toBeTruthy());
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

  const playlist = screen.getByRole("region", { name: "Playlist" });
  expect(within(playlist).getByText("Second Song")).toBeTruthy();
  expect(within(playlist).getByText("Third Song")).toBeTruthy();
  expect(within(playlist).queryByText("Wave Song")).toBeNull();
});
```

- [x] **Step 2: Write the failing invalid-track test**

Add this test in the `App` describe block:

```ts
it("ignores a saved playback track that is missing from the restored library", async () => {
  localStorage.setItem("musicplayer:last-folder", rememberedFolder);
  localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
  localStorage.setItem(
    playbackStateKey,
    JSON.stringify({
      trackId: "missing-track",
      currentTime: 42,
      queueTrackIds: [secondTrack.id],
      isPlayQueueExplicit: true,
      playlistLabel: "Missing"
    })
  );

  render(<App />);

  await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
  expect(window.musicApi.getPlayableUrl).not.toHaveBeenCalled();
  expect(screen.queryByText("0:42")).toBeNull();
});
```

- [x] **Step 3: Run tests and verify failure**

Run:

```bash
npm test -- src/renderer/App.test.tsx
```

Expected: the new startup restore test fails because no playback snapshot is read and no restore URL is loaded.

### Task 2: Add Hook-Level Paused Restore Test

**Files:**
- Modify: `src/renderer/hooks/useAudioPlayer.test.tsx`

- [x] **Step 1: Write the failing hook test**

Add this test in the `useAudioPlayer` describe block:

```ts
it("restores a track at a requested time without playing", async () => {
  const { result } = renderHook(() => useAudioPlayer(tracks));

  await act(async () => {
    await result.current.restoreTrack(tracks[1], 37);
  });

  expect(window.musicApi.getPlayableUrl).toHaveBeenCalledWith(tracks[1].filePath);
  expect(result.current.currentTrack?.title).toBe("Beta");
  expect(result.current.currentTime).toBe(37);
  expect(result.current.isPlaying).toBe(false);
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Run test and verify failure**

Run:

```bash
npm test -- src/renderer/hooks/useAudioPlayer.test.tsx
```

Expected: TypeScript or runtime failure because `restoreTrack` does not exist yet.

### Task 3: Implement Paused Restore in `useAudioPlayer`

**Files:**
- Modify: `src/renderer/hooks/useAudioPlayer.ts`
- Test: `src/renderer/hooks/useAudioPlayer.test.tsx`

- [x] **Step 1: Add a restore callback**

Add a `restoreTrack` callback near `playTrack`:

```ts
const restoreTrack = useCallback(async (track: Track, time: number) => {
  const audio = audioRef.current;
  const restoredTime = Number.isFinite(time) ? Math.max(0, time) : 0;

  setPlaybackError(null);
  setCurrentTrack(track);
  setCurrentTime(restoredTime);
  setIsPlaying(false);

  if (!audio) {
    return;
  }

  const url = await window.musicApi.getPlayableUrl(track.filePath);
  audio.src = url;
  audio.currentTime = restoredTime;
  audio.pause();
}, []);
```

Return `restoreTrack` from the hook:

```ts
restoreTrack,
```

- [x] **Step 2: Run the hook test**

Run:

```bash
npm test -- src/renderer/hooks/useAudioPlayer.test.tsx
```

Expected: hook tests pass.

### Task 4: Implement Playback Snapshot Persistence in `App.tsx`

**Files:**
- Modify: `src/renderer/App.tsx`
- Test: `src/renderer/App.test.tsx`

- [x] **Step 1: Add storage key and snapshot types**

Add beside existing storage keys:

```ts
const PLAYBACK_STATE_STORAGE_KEY = "musicplayer:playback-state";
```

Add below the constants:

```ts
type PlaybackState = {
  trackId: string;
  currentTime: number;
  queueTrackIds: string[];
  isPlayQueueExplicit: boolean;
  playlistLabel: string;
};
```

- [x] **Step 2: Track pending restore state**

Add state in `App`:

```ts
const [pendingPlaybackRestore, setPendingPlaybackRestore] = useState<PlaybackState | null>(null);
```

- [x] **Step 3: Apply restore snapshot when loading a library**

Inside `loadLibraryResult`, after setting the selected folder to `null`, read and apply the saved state:

```ts
const playbackState = readPlaybackState(result.tracks);
if (!playbackState) {
  setPendingPlaybackRestore(null);
  return;
}

const tracksById = new Map(result.tracks.map((track) => [track.id, track]));
const restoredQueue = playbackState.queueTrackIds
  .map((trackId) => tracksById.get(trackId))
  .filter((track): track is Track => Boolean(track));

setPlayQueue(restoredQueue.length > 0 ? restoredQueue : result.tracks);
setIsPlayQueueExplicit(playbackState.isPlayQueueExplicit && restoredQueue.length > 0);
setPlaylistLabel(playbackState.playlistLabel || "Library");
setPendingPlaybackRestore(playbackState);
```

- [x] **Step 4: Restore the hook after queue state is available**

Add an effect after `const player = useAudioPlayer(playlistTracks);`:

```ts
useEffect(() => {
  if (!pendingPlaybackRestore) {
    return;
  }

  const track = playlistTracks.find((queuedTrack) => queuedTrack.id === pendingPlaybackRestore.trackId) ?? null;
  if (!track) {
    setPendingPlaybackRestore(null);
    return;
  }

  setPendingPlaybackRestore(null);
  void player.restoreTrack(track, clampPlaybackTime(pendingPlaybackRestore.currentTime, track.duration));
}, [pendingPlaybackRestore, player, playlistTracks]);
```

- [x] **Step 5: Save snapshot when playback or queue state changes**

Add an effect after the restore effect:

```ts
useEffect(() => {
  if (!player.currentTrack) {
    return;
  }

  savePlaybackState({
    trackId: player.currentTrack.id,
    currentTime: clampPlaybackTime(player.currentTime, player.currentTrack.duration),
    queueTrackIds: playlistTracks.map((track) => track.id),
    isPlayQueueExplicit,
    playlistLabel
  });
}, [isPlayQueueExplicit, player.currentTime, player.currentTrack, playlistLabel, playlistTracks]);
```

- [x] **Step 6: Add validation helpers**

Add near the existing cache helpers:

```ts
function savePlaybackState(state: PlaybackState) {
  localStorage.setItem(PLAYBACK_STATE_STORAGE_KEY, JSON.stringify(state));
}

function readPlaybackState(tracks: Track[]): PlaybackState | null {
  const cachedValue = localStorage.getItem(PLAYBACK_STATE_STORAGE_KEY);
  if (!cachedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(cachedValue) as unknown;
    return isPlaybackStateForTracks(parsed, tracks) ? parsed : null;
  } catch {
    return null;
  }
}

function isPlaybackStateForTracks(value: unknown, tracks: Track[]): value is PlaybackState {
  if (!isRecord(value)) {
    return false;
  }

  const trackIds = new Set(tracks.map((track) => track.id));
  return (
    typeof value.trackId === "string" &&
    trackIds.has(value.trackId) &&
    typeof value.currentTime === "number" &&
    Number.isFinite(value.currentTime) &&
    value.currentTime >= 0 &&
    Array.isArray(value.queueTrackIds) &&
    value.queueTrackIds.every((trackId) => typeof trackId === "string") &&
    typeof value.isPlayQueueExplicit === "boolean" &&
    typeof value.playlistLabel === "string"
  );
}

function clampPlaybackTime(time: number, duration: number) {
  if (!Number.isFinite(time) || time < 0) {
    return 0;
  }

  if (Number.isFinite(duration) && duration > 0) {
    return Math.min(time, duration);
  }

  return time;
}
```

- [x] **Step 7: Run the App tests**

Run:

```bash
npm test -- src/renderer/App.test.tsx
```

Expected: App tests pass.

### Task 5: Final Verification

**Files:**
- Verify all changed files.

- [x] **Step 1: Run targeted tests**

Run:

```bash
npm test -- src/renderer/hooks/useAudioPlayer.test.tsx src/renderer/App.test.tsx
```

Expected: both targeted suites pass.

- [x] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: TypeScript exits 0.

- [x] **Step 3: Run full test suite**

Run:

```bash
npm test
```

Expected: all Vitest suites pass.

- [x] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: Electron build, TypeScript build, and Vite build exit 0.
