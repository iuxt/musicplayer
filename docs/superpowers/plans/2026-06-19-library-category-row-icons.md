# Library Category Row Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add aligned icon thumbnails to artist and folder rows in the library list.

**Architecture:** Keep the change inside `LibraryList.tsx`, where category rows are already rendered. Reuse the existing thumbnail column and `.track-artwork` visual treatment so artist and folder rows align with song artwork and album artwork without changing library data or click behavior.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, lucide-react.

---

## File Structure

- Modify `src/renderer/components/LibraryList.test.tsx`: add focused renderer tests for artist and folder category icon thumbnails.
- Modify `src/renderer/components/LibraryList.tsx`: import `Folder` and `UserRound`, render a reusable `CategoryIconThumbnail`, and insert it into artist and folder rows.
- Modify `src/renderer/styles.css`: make all category rows use the five-column thumbnail grid and add a small category-icon modifier.

---

### Task 1: Category Icon Thumbnail Tests

**Files:**
- Modify: `src/renderer/components/LibraryList.test.tsx`

- [ ] **Step 1: Add failing tests for artist and folder icons**

Add these tests inside the existing `describe("LibraryList", () => { ... })` block in `src/renderer/components/LibraryList.test.tsx`, after the album artwork test:

```tsx
  it("shows an artist icon thumbnail before artist group titles", () => {
    render(
      <LibraryList
        category="artists"
        tracks={[makeTrack(1, { artist: "Artist One" })]}
        currentTrack={null}
        search=""
        selectedFolderPath={null}
        onSearchChange={() => undefined}
        onSelectTrack={() => undefined}
        onOpenFolder={() => undefined}
        onBackToFolders={() => undefined}
        onTrackContextMenu={() => undefined}
      />
    );

    const artistIcon = screen.getByRole("img", { name: "歌手" });

    expect(artistIcon.classList.contains("category-icon-thumbnail")).toBe(true);
    expect(screen.getByRole("button", { name: /Artist One.*1 首歌曲.*播放/ })).toBeTruthy();
  });

  it("shows a folder icon thumbnail before folder titles", () => {
    render(
      <LibraryList
        category="folders"
        tracks={[makeTrack(1, { folderPath: "Artist One/Album One" })]}
        currentTrack={null}
        search=""
        selectedFolderPath={null}
        onSearchChange={() => undefined}
        onSelectTrack={() => undefined}
        onOpenFolder={() => undefined}
        onBackToFolders={() => undefined}
        onTrackContextMenu={() => undefined}
      />
    );

    const folderIcon = screen.getByRole("img", { name: "文件夹" });

    expect(folderIcon.classList.contains("category-icon-thumbnail")).toBe(true);
    expect(screen.getByRole("button", { name: /Artist One.*1 首歌曲.*打开/ })).toBeTruthy();
  });
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
npm test -- src/renderer/components/LibraryList.test.tsx
```

Expected: FAIL. The failure should say no accessible element with role `"img"` and name `"歌手"` or `"文件夹"` exists.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/renderer/components/LibraryList.test.tsx
git commit -m "test: cover library category row icons"
```

---

### Task 2: Category Icon Thumbnail Implementation

**Files:**
- Modify: `src/renderer/components/LibraryList.tsx`
- Modify: `src/renderer/styles.css`

- [ ] **Step 1: Update the lucide imports**

Change the first line of `src/renderer/components/LibraryList.tsx` to:

```tsx
import { ChevronLeft, Disc3, Folder, Search, UserRound } from "lucide-react";
```

- [ ] **Step 2: Add the folder icon to folder rows**

In the folder row button inside the `category === "folders"` branch, render `CategoryIconThumbnail` immediately after the index:

```tsx
              <button className="track-row category-row" onClick={() => onOpenFolder(row.path)} type="button">
                <span className="track-index">{String(index + 1).padStart(2, "0")}</span>
                <CategoryIconThumbnail type="folder" />
                <span className="track-title">
                  <strong>{row.label}</strong>
                  <small>{row.detail}</small>
                </span>
                <span className="track-album">{row.tracks.length} 首歌曲</span>
                <span className="track-duration">打开</span>
              </button>
```

- [ ] **Step 3: Add the artist icon to artist rows**

Replace the conditional artwork render in `GroupRow` with this expression:

```tsx
      {isAlbum ? (
        <ArtworkThumbnail alt={`${group.label} 封面`} artworkPath={artworkPath} />
      ) : (
        <CategoryIconThumbnail type="artist" />
      )}
```

- [ ] **Step 4: Add the reusable category thumbnail component**

Add this component after `ArtworkThumbnail` in `src/renderer/components/LibraryList.tsx`:

```tsx
function CategoryIconThumbnail({ type }: { type: "artist" | "folder" }) {
  const Icon = type === "artist" ? UserRound : Folder;
  const label = type === "artist" ? "歌手" : "文件夹";

  return (
    <span className="track-artwork category-icon-thumbnail" role="img" aria-label={label}>
      <Icon size={18} aria-hidden="true" />
    </span>
  );
}
```

- [ ] **Step 5: Update the category row grid and icon styling**

In `src/renderer/styles.css`, replace this selector:

```css
.song-row,
.album-row {
  grid-template-columns: 44px 42px minmax(0, 1.4fr) minmax(120px, 0.8fr) 54px;
}
```

with:

```css
.song-row,
.category-row {
  grid-template-columns: 44px 42px minmax(0, 1.4fr) minmax(120px, 0.8fr) 54px;
}
```

Add this modifier immediately after the `.track-artwork` rule:

```css
.category-icon-thumbnail {
  color: rgba(255, 255, 255, 0.94);
}
```

- [ ] **Step 6: Run the focused tests and verify they pass**

Run:

```bash
npm test -- src/renderer/components/LibraryList.test.tsx
```

Expected: PASS. The new artist and folder icon tests pass, and the existing LibraryList tests keep passing.

- [ ] **Step 7: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 8: Commit the implementation**

```bash
git add src/renderer/components/LibraryList.tsx src/renderer/styles.css
git commit -m "feat: add library category row icons"
```

---

### Task 3: Final Verification

**Files:**
- Verify: `src/renderer/components/LibraryList.test.tsx`
- Verify: `src/renderer/components/LibraryList.tsx`
- Verify: `src/renderer/styles.css`

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS. Existing renderer, main, and script tests pass.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS. Electron TypeScript, renderer TypeScript, and Vite build all complete successfully.

- [ ] **Step 3: Review the final diff**

Run:

```bash
git diff --stat HEAD~2..HEAD
git show --stat --oneline --decorate --no-renames HEAD
```

Expected: the diff contains only the LibraryList test, LibraryList component, and stylesheet changes from this implementation.
