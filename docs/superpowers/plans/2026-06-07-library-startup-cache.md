# Library Startup Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache the last scanned local music library so app startup does not rescan unless the cache is missing, invalid, or the user explicitly requests a scan.

**Architecture:** Keep the cache in renderer `localStorage` next to the existing remembered folder key. `App.tsx` remains the owner of library state and writes cache after successful choose-folder and rescan flows. The scanner and Electron IPC stay unchanged.

**Tech Stack:** Electron, React, TypeScript, Vitest, Testing Library, browser `localStorage`.

---

### Task 1: Startup Cache Behavior

**Files:**
- Modify: `src/renderer/App.test.tsx`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Write failing tests**

Add tests that store `musicplayer:last-folder` and `musicplayer:library-cache`, render `<App />`, and expect cached tracks to appear without `window.musicApi.rescanLibrary` being called. Keep a separate startup fallback test that has only the folder key and expects `rescanLibrary(rememberedFolder)`.

- [ ] **Step 2: Run test to verify RED**

Run: `npm test -- src/renderer/App.test.tsx`

Expected: FAIL because startup still calls `rescanLibrary` even when a cache exists.

- [ ] **Step 3: Implement minimal cache helpers**

In `App.tsx`, add `LIBRARY_CACHE_STORAGE_KEY`, a `loadLibraryResult(result)` helper, `saveLibraryCache(result)`, and `readLibraryCache(folderPath)`. Validate parsed cache as a `ScanResult` with matching `folderPath`, `tracks` array, and `warnings` array.

- [ ] **Step 4: Use cache on startup**

In the remembered-folder effect, try `readLibraryCache(rememberedFolderPath)` first. If it returns a result, load it into state and return without setting scanning state or calling `rescanLibrary`. If it returns null, keep the existing rescan fallback and save the fresh result.

- [ ] **Step 5: Save cache on explicit scans**

After successful `chooseMusicFolder()` and `rescanLibrary()`, call the shared load helper and `saveLibraryCache(result)`.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npm test -- src/renderer/App.test.tsx
npm run typecheck
```

Expected: both commands pass.
