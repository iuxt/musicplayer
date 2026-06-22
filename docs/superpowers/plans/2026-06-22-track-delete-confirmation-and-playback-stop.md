# Track Delete Confirmation And Playback Stop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the selected music filename in the delete confirmation and stop current playback before deleting the currently loaded track.

**Architecture:** Keep the change in the renderer because the main-process trash API already receives the selected track and returns the correct structured deletion result. `App.tsx` owns the confirmation text, current-track stop ordering, and state synchronization; `TrackContextMenu.tsx` owns only the visible menu label. Existing App tests cover the behavior with mocked preload APIs and mocked audio elements.

**Tech Stack:** Electron, React, TypeScript, Vitest, Testing Library, lucide-react.

---

## File Structure

- Modify `src/renderer/App.test.tsx`: add failing coverage for filename confirmation and current-track stop-before-trash behavior; update the existing delete test to use the new menu label.
- Modify `src/renderer/App.tsx`: add a small basename helper, include the basename in the confirmation message, and stop the current track before calling `window.musicApi.trashTrackFiles(track)`.
- Modify `src/renderer/components/TrackContextMenu.tsx`: change the destructive delete menu item text to `移到废纸篓`.

---

### Task 1: Renderer Delete Flow Tests

**Files:**
- Modify: `src/renderer/App.test.tsx`

- [ ] **Step 1: Add failing tests for filename confirmation and current-track stop ordering**

In `src/renderer/App.test.tsx`, replace the existing test named `trashes a track and removes it from library and playlist` with these three tests in the same location:

```ts
  it("shows the disk filename in the track trash confirmation", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.contextMenu(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "移到废纸篓" }));

    expect(confirmSpy).toHaveBeenCalledWith("将把音乐文件“Wave Song.wav”以及同名歌词、同名封面移到废纸篓。是否继续？");
    expect(window.musicApi.trashTrackFiles).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("stops the current track before trashing it and does not start the next track", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const deleteEvents: string[] = [];
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(() => {
        deleteEvents.push("pause");
      })
    });
    window.musicApi.trashTrackFiles = vi.fn(async () => {
      deleteEvents.push("trash");
      return { ok: true, audioRemoved: true, trashed: [], failed: [], error: null };
    });

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    });
    await waitFor(() => expect(window.musicApi.getPlayableUrl).toHaveBeenCalledWith(track.filePath));

    fireEvent.contextMenu(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "移到废纸篓" }));

    await waitFor(() => expect(window.musicApi.trashTrackFiles).toHaveBeenCalledWith(track));
    expect(deleteEvents).toEqual(["pause", "trash"]);
    expect(window.musicApi.getPlayableUrl).not.toHaveBeenCalledWith(folderTrack.filePath);

    confirmSpy.mockRestore();
  });

  it("trashes a track and removes it from library and playlist", async () => {
    localStorage.setItem("musicplayer:last-folder", rememberedFolder);
    localStorage.setItem(libraryCacheKey, JSON.stringify(scanResult));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Wave Song").length).toBeGreaterThan(0));
    fireEvent.contextMenu(screen.getByRole("button", { name: "01 Wave Song Artist Wave Album 3:00" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "移到废纸篓" }));

    await waitFor(() => expect(window.musicApi.trashTrackFiles).toHaveBeenCalledWith(track));
    expect(within(screen.getByRole("region", { name: "音乐库浏览器" })).queryByText("Wave Song")).toBeNull();
    expect(within(screen.getByRole("region", { name: "播放列表" })).queryByText("Wave Song")).toBeNull();

    confirmSpy.mockRestore();
  });
```

- [ ] **Step 2: Run the targeted tests and verify they fail**

Run:

```bash
npm test -- src/renderer/App.test.tsx
```

Expected: FAIL. The failure should show that the `移到废纸篓` menu item is not found, or that the confirmation text does not yet include `Wave Song.wav`. There should be no TypeScript syntax errors.

- [ ] **Step 3: Keep the failing tests in the working tree**

Run:

```bash
git status --short
```

Expected: `src/renderer/App.test.tsx` is modified and uncommitted. The failing test state is not committed; it will be committed together with the implementation after the targeted tests pass.

---

### Task 2: Confirmation Filename And Stop-Before-Trash Implementation

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/TrackContextMenu.tsx`

- [ ] **Step 1: Add a renderer basename helper**

In `src/renderer/App.tsx`, add this helper after the existing constants near the top of the file:

```ts
function getFileNameForDisplay(filePath: string) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const segments = normalizedPath.split("/").filter(Boolean);
  return segments[segments.length - 1] || filePath;
}
```

- [ ] **Step 2: Update the delete confirmation and stop current playback before trashing**

Replace the existing `deleteTrackFiles` callback in `src/renderer/App.tsx` with this implementation:

```ts
  const deleteTrackFiles = useCallback(
    async (track: Track) => {
      const fileName = getFileNameForDisplay(track.filePath);
      const confirmed = window.confirm(`将把音乐文件“${fileName}”以及同名歌词、同名封面移到废纸篓。是否继续？`);
      if (!confirmed) {
        setTrackMenu(null);
        return;
      }

      setPendingMediaAction(true);
      setAppError(null);
      if (player.currentTrack?.id === track.id) {
        setLyrics(null);
        setArtworkUrl(null);
        setIsLyricsLoading(false);
        player.stop();
      }

      try {
        const result = await window.musicApi.trashTrackFiles(track);
        if (result.audioRemoved) {
          await removeTrackFromLibrary(track);
        }
        if (!result.ok && result.error) {
          setAppError(result.error);
        }
      } catch (error) {
        setAppError(error instanceof Error ? error.message : "无法将音乐文件移到废纸篓。");
      } finally {
        setPendingMediaAction(false);
        setTrackMenu(null);
      }
    },
    [player, removeTrackFromLibrary]
  );
```

This intentionally calls `player.stop()` before `window.musicApi.trashTrackFiles(track)`. After `player.stop()`, `removeTrackFromLibrary(track)` will not auto-select or auto-play the next queue item because `player.currentTrack` is already cleared.

- [ ] **Step 3: Update the context menu destructive label**

In `src/renderer/components/TrackContextMenu.tsx`, change the destructive menu item text from:

```tsx
          删除当前音乐文件
```

to:

```tsx
          移到废纸篓
```

- [ ] **Step 4: Run the targeted tests and verify they pass**

Run:

```bash
npm test -- src/renderer/App.test.tsx
```

Expected: PASS. The output should include `src/renderer/App.test.tsx` with all App tests passing.

- [ ] **Step 5: Run type checking**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the tests and implementation**

Run:

```bash
git add src/renderer/App.test.tsx src/renderer/App.tsx src/renderer/components/TrackContextMenu.tsx
git commit -m "fix: stop playback before trashing current track"
```

Expected: a commit is created with the renderer tests and implementation files.

---

### Task 3: Final Verification

**Files:**
- Verify: full repository

- [ ] **Step 1: Run the full automated test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS. The Electron TypeScript build, renderer TypeScript build, and Vite build should complete successfully.

- [ ] **Step 3: Inspect the final diff**

Run:

```bash
git status --short
git log --oneline -3
```

Expected: the worktree is clean, and the latest commit is the implementation commit on top of the plan/spec commits.
