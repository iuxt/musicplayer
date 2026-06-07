# Playlist Queue Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clear and remove actions to the current playlist queue without deleting local files or changing the scanned library.

**Architecture:** Keep the queue state in `App.tsx`, but distinguish an automatic library-backed queue from a user-edited explicit queue. `Playlist.tsx` remains a presentation component and receives clear/remove callbacks.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, lucide-react.

---

## File Structure

- Modify `src/renderer/App.test.tsx` to add renderer behavior tests for clearing and removing playlist tracks.
- Modify `src/renderer/App.tsx` to track whether the queue has been explicitly edited and to pass queue action callbacks to `Playlist`.
- Modify `src/renderer/components/Playlist.tsx` to render clear/remove controls and an empty queue state.
- Modify `src/renderer/styles.css` to add compact playlist action styles without changing the broader layout.

### Task 1: Renderer Behavior Tests

**Files:**
- Modify: `src/renderer/App.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests that load the remembered library, remove one track from the playlist, clear the playlist, and verify the library browser still contains the tracks.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/renderer/App.test.tsx`

Expected: tests fail because the playlist action buttons do not exist.

### Task 2: Queue State And Playlist Callbacks

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/Playlist.tsx`

- [ ] **Step 1: Implement explicit queue state**

Add a boolean state that records when the user explicitly edited the queue. Use this state to decide whether an empty queue should stay empty or fall back to filtered library tracks.

- [ ] **Step 2: Implement clear and remove callbacks**

Add `clearPlaylist` and `removePlaylistTrack` in `App.tsx`. Both callbacks only update `playQueue` and the explicit queue flag.

- [ ] **Step 3: Render playlist controls**

Add clear and remove icon buttons in `Playlist.tsx`. Stop propagation on the remove button so row selection does not also fire.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- src/renderer/App.test.tsx`

Expected: all App tests pass.

### Task 3: Styling And Full Verification

**Files:**
- Modify: `src/renderer/styles.css`

- [ ] **Step 1: Add compact action styles**

Style playlist heading and row actions so text still truncates cleanly and row height remains stable.

- [ ] **Step 2: Run verification**

Run: `npm test -- src/renderer/App.test.tsx src/renderer/components/PlayerBar.test.tsx src/renderer/hooks/useAudioPlayer.test.tsx`

Run: `npm run typecheck`

Expected: tests and typecheck pass.
