# Desktop Lyrics Color Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users set separate opaque colors for the current desktop lyric line and the next desktop lyric line.

**Architecture:** Extend the existing renderer settings model and reuse the current `AppSettings -> App.tsx -> buildDesktopLyricsPayload -> DesktopLyrics` flow. Colors are stored as normalized uppercase `#RRGGBB` strings, displayed in `SettingsPage`, sent through the existing desktop lyrics payload, and applied with scoped CSS variables.

**Tech Stack:** Electron, Vite, React 19, TypeScript, Vitest, Testing Library, CSS custom properties, `localStorage`.

---

## File Structure

- Modify `src/renderer/appSettings.ts`: add desktop lyric color fields, defaults, hex validation, and normalization.
- Modify `src/renderer/appSettings.test.ts`: cover default colors, legacy migration, valid normalized colors, invalid persisted colors, and normalized writes.
- Modify `src/shared/types.ts`: add `currentColor` and `nextColor` to `DesktopLyricsPayload`.
- Modify `src/renderer/lyrics.ts`: accept desktop lyric colors in `buildDesktopLyricsPayload` input and include them in every returned payload.
- Modify `src/renderer/lyrics.test.ts`: assert payload colors in normal, loading, no-lyrics, and no-track states.
- Modify `src/renderer/DesktopLyricsWindow.tsx`: include default colors in `INITIAL_PAYLOAD`.
- Modify `src/renderer/DesktopLyricsWindow.test.tsx`: include colors in test payloads sent through the desktop lyric update channel.
- Modify `src/renderer/components/DesktopLyrics.tsx`: expose color CSS variables from the payload.
- Modify `src/renderer/components/DesktopLyrics.test.tsx`: assert color CSS variables are present.
- Modify `src/renderer/components/SettingsPage.tsx`: add compact current-line and next-line color controls and preview color styling.
- Modify `src/renderer/components/SettingsPage.test.tsx`: cover color controls, callbacks, and preview colors.
- Modify `src/renderer/App.tsx`: wire new settings, callbacks, payload inputs, memo dependencies, and settings props.
- Modify `src/renderer/App.test.tsx`: extend the existing desktop lyrics integration test to cover color persistence and payload forwarding.
- Modify `src/renderer/styles.css`: add color-control styles and apply desktop lyric color CSS variables.
- Modify `src/renderer/styles.test.ts`: assert desktop lyric CSS uses color variables while preserving transparent, outlined, text-only behavior.

## Task 1: Settings Model

**Files:**
- Modify: `src/renderer/appSettings.ts`
- Modify: `src/renderer/appSettings.test.ts`

- [ ] **Step 1: Write failing settings tests**

In `src/renderer/appSettings.test.ts`, update every expected full `DEFAULT_APP_SETTINGS` object to include:

```ts
desktopLyricsCurrentColor: "#FFFFFF",
desktopLyricsNextColor: "#9CA3AF",
```

Add this import:

```ts
  DEFAULT_DESKTOP_LYRICS_CURRENT_COLOR,
  DEFAULT_DESKTOP_LYRICS_NEXT_COLOR,
```

Add these tests inside `describe("appSettings", () => { ... })`:

```ts
  it("fills missing desktop lyric colors with defaults for legacy settings", () => {
    const storage = makeStorage({
      [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
        fullscreenLyricsFontFamily: "",
        fullscreenLyricsFontSize: 36,
        systemMediaShortcutsEnabled: false,
        closeWindowStopsPlayback: false,
        desktopLyricsEnabled: false,
        desktopLyricsFontFamily: "",
        desktopLyricsFontSize: 28,
        volume: 0.82,
        shuffle: false,
        repeat: "off"
      })
    });

    expect(readAppSettings(storage)).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("reads and writes desktop lyric colors", () => {
    const storage = makeStorage({
      [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
        ...DEFAULT_APP_SETTINGS,
        desktopLyricsCurrentColor: "#ffcc00",
        desktopLyricsNextColor: "#5eead4"
      })
    });

    expect(readAppSettings(storage)).toEqual({
      ...DEFAULT_APP_SETTINGS,
      desktopLyricsCurrentColor: "#FFCC00",
      desktopLyricsNextColor: "#5EEAD4"
    });

    writeAppSettings(
      {
        ...DEFAULT_APP_SETTINGS,
        desktopLyricsCurrentColor: "#f472b6",
        desktopLyricsNextColor: "#38bdf8"
      },
      storage
    );

    expect(storage.setItem).toHaveBeenCalledWith(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_APP_SETTINGS,
        desktopLyricsCurrentColor: "#F472B6",
        desktopLyricsNextColor: "#38BDF8"
      })
    );
  });

  it("returns defaults for invalid persisted desktop lyric colors", () => {
    expect(
      readAppSettings(
        makeStorage({
          [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
            ...DEFAULT_APP_SETTINGS,
            desktopLyricsCurrentColor: "white"
          })
        })
      )
    ).toEqual(DEFAULT_APP_SETTINGS);

    expect(
      readAppSettings(
        makeStorage({
          [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
            ...DEFAULT_APP_SETTINGS,
            desktopLyricsNextColor: "#FFF"
          })
        })
      )
    ).toEqual(DEFAULT_APP_SETTINGS);

    expect(
      readAppSettings(
        makeStorage({
          [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
            ...DEFAULT_APP_SETTINGS,
            desktopLyricsNextColor: null
          })
        })
      )
    ).toEqual(DEFAULT_APP_SETTINGS);
  });
```

In the existing `"writes normalized settings"` test, add lower-case colors to the input object:

```ts
        desktopLyricsCurrentColor: "#ffffff",
        desktopLyricsNextColor: "#9ca3af",
```

Add normalized uppercase colors to the expected JSON:

```ts
        desktopLyricsCurrentColor: DEFAULT_DESKTOP_LYRICS_CURRENT_COLOR,
        desktopLyricsNextColor: DEFAULT_DESKTOP_LYRICS_NEXT_COLOR,
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- src/renderer/appSettings.test.ts
```

Expected: FAIL because `DEFAULT_DESKTOP_LYRICS_CURRENT_COLOR`, `DEFAULT_DESKTOP_LYRICS_NEXT_COLOR`, `desktopLyricsCurrentColor`, and `desktopLyricsNextColor` are not defined.

- [ ] **Step 3: Implement desktop lyric color settings**

In `src/renderer/appSettings.ts`, add constants near the existing desktop lyrics size constants:

```ts
export const DEFAULT_DESKTOP_LYRICS_CURRENT_COLOR = "#FFFFFF";
export const DEFAULT_DESKTOP_LYRICS_NEXT_COLOR = "#9CA3AF";
```

Extend `AppSettings`:

```ts
  desktopLyricsCurrentColor: string;
  desktopLyricsNextColor: string;
```

Extend `DEFAULT_APP_SETTINGS`:

```ts
  desktopLyricsCurrentColor: DEFAULT_DESKTOP_LYRICS_CURRENT_COLOR,
  desktopLyricsNextColor: DEFAULT_DESKTOP_LYRICS_NEXT_COLOR,
```

In `normalizeAppSettings`, after `desktopFontFamily` and before boolean settings, read the color values:

```ts
  const desktopLyricsCurrentColor = normalizeHexColor(
    getValueOrDefault(value, "desktopLyricsCurrentColor", DEFAULT_APP_SETTINGS.desktopLyricsCurrentColor)
  );
  const desktopLyricsNextColor = normalizeHexColor(
    getValueOrDefault(value, "desktopLyricsNextColor", DEFAULT_APP_SETTINGS.desktopLyricsNextColor)
  );
```

Add both colors to the invalid-value guard:

```ts
    desktopLyricsCurrentColor === null ||
    desktopLyricsNextColor === null ||
```

Add both fields to the returned object:

```ts
    desktopLyricsCurrentColor,
    desktopLyricsNextColor,
```

Add this helper near `normalizeFontSize`:

```ts
function normalizeHexColor(value: unknown) {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    return null;
  }

  return value.toUpperCase();
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run:

```bash
npm test -- src/renderer/appSettings.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit settings model**

Run:

```bash
git add src/renderer/appSettings.ts src/renderer/appSettings.test.ts
git commit -m "feat: add desktop lyric color settings"
```

Expected: commit succeeds.

## Task 2: Desktop Lyrics Payload And Rendering

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/renderer/lyrics.ts`
- Modify: `src/renderer/lyrics.test.ts`
- Modify: `src/renderer/DesktopLyricsWindow.tsx`
- Modify: `src/renderer/DesktopLyricsWindow.test.tsx`
- Modify: `src/renderer/components/DesktopLyrics.tsx`
- Modify: `src/renderer/components/DesktopLyrics.test.tsx`

- [ ] **Step 1: Write failing payload tests**

In `src/renderer/lyrics.test.ts`, update each `buildDesktopLyricsPayload` call to include:

```ts
        currentColor: "#FFCC00",
        nextColor: "#5EEAD4"
```

For calls that use defaults in the existing loading/no-lyrics/no-track test, use:

```ts
        currentColor: "#FFFFFF",
        nextColor: "#9CA3AF"
```

Update the expected object in `"builds a desktop lyrics payload for a timed lyric"`:

```ts
    ).toEqual({
      trackTitle: "Song",
      artist: "Artist",
      currentLine: "Current",
      nextLine: "Later",
      isLoading: false,
      fontFamily: "PingFang SC",
      fontSize: 30,
      currentColor: "#FFCC00",
      nextColor: "#5EEAD4"
    });
```

In `"builds loading, no-lyrics, and no-track desktop payloads"`, add one full assertion for each state:

```ts
    expect(
      buildDesktopLyricsPayload({
        track: makeTrack({ hasLyrics: true, lyricsPath: "/music/song.lrc" }),
        lyrics: null,
        isLyricsLoading: true,
        currentTime: 0,
        fontFamily: "",
        fontSize: 28,
        currentColor: "#FFFFFF",
        nextColor: "#9CA3AF"
      })
    ).toMatchObject({
      currentLine: "正在加载歌词...",
      isLoading: true,
      currentColor: "#FFFFFF",
      nextColor: "#9CA3AF"
    });

    expect(
      buildDesktopLyricsPayload({
        track: makeTrack({ hasLyrics: false, lyricsPath: null }),
        lyrics: null,
        isLyricsLoading: false,
        currentTime: 0,
        fontFamily: "",
        fontSize: 28,
        currentColor: "#FFFFFF",
        nextColor: "#9CA3AF"
      })
    ).toMatchObject({
      currentLine: "未找到歌词。",
      currentColor: "#FFFFFF",
      nextColor: "#9CA3AF"
    });

    expect(
      buildDesktopLyricsPayload({
        track: null,
        lyrics: null,
        isLyricsLoading: false,
        currentTime: 0,
        fontFamily: "",
        fontSize: 28,
        currentColor: "#FFFFFF",
        nextColor: "#9CA3AF"
      })
    ).toMatchObject({
      currentLine: "暂无播放",
      currentColor: "#FFFFFF",
      nextColor: "#9CA3AF"
    });
```

In `src/renderer/components/DesktopLyrics.test.tsx`, add colors to the payload in the first test:

```ts
          currentColor: "#FFCC00",
          nextColor: "#5EEAD4"
```

Add CSS variable assertions:

```ts
    expect((surface as HTMLElement).style.getPropertyValue("--desktop-lyrics-current-color")).toBe("#FFCC00");
    expect((surface as HTMLElement).style.getPropertyValue("--desktop-lyrics-next-color")).toBe("#5EEAD4");
```

Update `makePayload()` in the same file:

```ts
    currentColor: "#FFFFFF",
    nextColor: "#9CA3AF"
```

In `src/renderer/DesktopLyricsWindow.test.tsx`, add colors to every payload passed to `updateHandler`:

```ts
        currentColor: "#FFFFFF",
        nextColor: "#9CA3AF"
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- src/renderer/lyrics.test.ts src/renderer/components/DesktopLyrics.test.tsx src/renderer/DesktopLyricsWindow.test.tsx
```

Expected: FAIL because `DesktopLyricsPayload` and `buildDesktopLyricsPayload` do not include color fields.

- [ ] **Step 3: Implement payload color fields**

In `src/shared/types.ts`, extend `DesktopLyricsPayload`:

```ts
  currentColor: string;
  nextColor: string;
```

In `src/renderer/lyrics.ts`, extend `DesktopLyricsPayloadInput`:

```ts
  currentColor: string;
  nextColor: string;
```

Destructure the new input fields:

```ts
  currentColor,
  nextColor
```

Add the fields to every object returned by `buildDesktopLyricsPayload`:

```ts
      currentColor,
      nextColor
```

In `src/renderer/DesktopLyricsWindow.tsx`, extend `INITIAL_PAYLOAD`:

```ts
  currentColor: "#FFFFFF",
  nextColor: "#9CA3AF"
```

- [ ] **Step 4: Implement DesktopLyrics CSS variables**

In `src/renderer/components/DesktopLyrics.tsx`, extend the `style` object:

```ts
    "--desktop-lyrics-current-color": payload.currentColor,
    "--desktop-lyrics-next-color": payload.nextColor
```

Update the type assertion:

```ts
  } as CSSProperties &
    Record<
      | "--desktop-lyrics-font-family"
      | "--desktop-lyrics-font-size"
      | "--desktop-lyrics-current-color"
      | "--desktop-lyrics-next-color",
      string
    >;
```

Add colors to the `useLayoutEffect` dependency list:

```ts
    payload.currentColor,
    payload.nextColor,
```

- [ ] **Step 5: Run tests and verify they pass**

Run:

```bash
npm test -- src/renderer/lyrics.test.ts src/renderer/components/DesktopLyrics.test.tsx src/renderer/DesktopLyricsWindow.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit payload and rendering**

Run:

```bash
git add src/shared/types.ts src/renderer/lyrics.ts src/renderer/lyrics.test.ts src/renderer/DesktopLyricsWindow.tsx src/renderer/DesktopLyricsWindow.test.tsx src/renderer/components/DesktopLyrics.tsx src/renderer/components/DesktopLyrics.test.tsx
git commit -m "feat: pass desktop lyric colors to floating window"
```

Expected: commit succeeds.

## Task 3: Settings Page Color Controls

**Files:**
- Modify: `src/renderer/components/SettingsPage.tsx`
- Modify: `src/renderer/components/SettingsPage.test.tsx`

- [ ] **Step 1: Write failing SettingsPage tests**

In `src/renderer/components/SettingsPage.test.tsx`, update `makeProps()` defaults:

```ts
    desktopLyricsCurrentColor: "#FFFFFF",
    desktopLyricsNextColor: "#9CA3AF",
    onDesktopLyricsCurrentColorChange: vi.fn(),
    onDesktopLyricsNextColorChange: vi.fn(),
```

Add this test:

```ts
  it("changes desktop lyrics color settings", () => {
    const props = makeProps({
      desktopLyricsCurrentColor: "#FFCC00",
      desktopLyricsNextColor: "#5EEAD4"
    });

    render(<SettingsPage {...props} />);
    fireEvent.change(screen.getByLabelText("当前歌词颜色"), { target: { value: "#f472b6" } });
    fireEvent.change(screen.getByLabelText("下一句颜色"), { target: { value: "#38bdf8" } });

    expect(props.onDesktopLyricsCurrentColorChange).toHaveBeenCalledWith("#f472b6");
    expect(props.onDesktopLyricsNextColorChange).toHaveBeenCalledWith("#38bdf8");
    expect(screen.getByText("#FFCC00")).toBeTruthy();
    expect(screen.getByText("#5EEAD4")).toBeTruthy();
  });
```

Add this test:

```ts
  it("previews desktop lyric colors", () => {
    render(
      <SettingsPage
        {...makeProps({
          desktopLyricsCurrentColor: "#FFCC00",
          desktopLyricsNextColor: "#5EEAD4"
        })}
      />
    );

    const preview = screen.getByText("桌面歌词预览行").closest(".desktop-lyrics-preview") as HTMLElement;

    expect(preview.style.getPropertyValue("--desktop-lyrics-preview-current-color")).toBe("#FFCC00");
    expect(preview.style.getPropertyValue("--desktop-lyrics-preview-next-color")).toBe("#5EEAD4");
  });
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- src/renderer/components/SettingsPage.test.tsx
```

Expected: FAIL because `SettingsPageProps` has no color props or callbacks, and no color controls render.

- [ ] **Step 3: Implement SettingsPage props and controls**

In `src/renderer/components/SettingsPage.tsx`, change the React import line to include `CSSProperties`:

```ts
import { type CSSProperties } from "react";
```

Add these props to `SettingsPageProps`:

```ts
  desktopLyricsCurrentColor: string;
  desktopLyricsNextColor: string;
  onDesktopLyricsCurrentColorChange: (color: string) => void;
  onDesktopLyricsNextColorChange: (color: string) => void;
```

Destructure them in the component parameter list.

After the desktop lyric font size select, insert:

```tsx
          <div className="lyrics-color-controls">
            <label className="lyrics-color-control">
              <span>当前歌词颜色</span>
              <span className="lyrics-color-picker">
                <input
                  aria-label="当前歌词颜色"
                  onChange={(event) => onDesktopLyricsCurrentColorChange(event.target.value)}
                  type="color"
                  value={desktopLyricsCurrentColor}
                />
                <code>{desktopLyricsCurrentColor}</code>
              </span>
            </label>
            <label className="lyrics-color-control">
              <span>下一句颜色</span>
              <span className="lyrics-color-picker">
                <input
                  aria-label="下一句颜色"
                  onChange={(event) => onDesktopLyricsNextColorChange(event.target.value)}
                  type="color"
                  value={desktopLyricsNextColor}
                />
                <code>{desktopLyricsNextColor}</code>
              </span>
            </label>
          </div>
```

Update the desktop preview style prop:

```tsx
            style={
              {
                fontFamily: desktopLyricsFontFamily || undefined,
                fontSize: `${desktopLyricsFontSize}px`,
                "--desktop-lyrics-preview-current-color": desktopLyricsCurrentColor,
                "--desktop-lyrics-preview-next-color": desktopLyricsNextColor
              } as CSSProperties &
                Record<
                  "--desktop-lyrics-preview-current-color" | "--desktop-lyrics-preview-next-color",
                  string
                >
            }
```

- [ ] **Step 4: Run tests and verify they pass**

Run:

```bash
npm test -- src/renderer/components/SettingsPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit SettingsPage controls**

Run:

```bash
git add src/renderer/components/SettingsPage.tsx src/renderer/components/SettingsPage.test.tsx
git commit -m "feat: add desktop lyric color controls"
```

Expected: commit succeeds.

## Task 4: App Wiring

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/App.test.tsx`

- [ ] **Step 1: Write failing App integration test**

In `src/renderer/App.test.tsx`, extend the existing `"opens and updates desktop lyrics when enabled"` test.

After changing the desktop lyric font size, add:

```ts
    fireEvent.change(screen.getByLabelText("当前歌词颜色"), { target: { value: "#ffcc00" } });
    fireEvent.change(screen.getByLabelText("下一句颜色"), { target: { value: "#5eead4" } });
```

Extend the persisted settings assertion:

```ts
      desktopLyricsCurrentColor: "#FFCC00",
      desktopLyricsNextColor: "#5EEAD4"
```

Extend the payload assertion:

```ts
          currentColor: "#FFCC00",
          nextColor: "#5EEAD4"
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- src/renderer/App.test.tsx
```

Expected: FAIL because `App.tsx` does not pass color props to `SettingsPage` or colors to `buildDesktopLyricsPayload`.

- [ ] **Step 3: Implement color change callbacks**

In `src/renderer/App.tsx`, add callbacks after `changeDesktopLyricsFontSize`:

```ts
  const changeDesktopLyricsCurrentColor = useCallback(
    (color: string) => {
      commitAppSettings((currentSettings) => ({ ...currentSettings, desktopLyricsCurrentColor: color }));
    },
    [commitAppSettings]
  );

  const changeDesktopLyricsNextColor = useCallback(
    (color: string) => {
      commitAppSettings((currentSettings) => ({ ...currentSettings, desktopLyricsNextColor: color }));
    },
    [commitAppSettings]
  );
```

- [ ] **Step 4: Wire colors into payload creation**

In the `buildDesktopLyricsPayload` call, add:

```ts
        currentColor: appSettings.desktopLyricsCurrentColor,
        nextColor: appSettings.desktopLyricsNextColor
```

In the `useMemo` dependency list for `desktopLyricsPayload`, add:

```ts
      appSettings.desktopLyricsCurrentColor,
      appSettings.desktopLyricsNextColor,
```

- [ ] **Step 5: Wire colors into SettingsPage**

In the `SettingsPage` JSX props, add:

```tsx
            desktopLyricsCurrentColor={appSettings.desktopLyricsCurrentColor}
            desktopLyricsNextColor={appSettings.desktopLyricsNextColor}
            onDesktopLyricsCurrentColorChange={changeDesktopLyricsCurrentColor}
            onDesktopLyricsNextColorChange={changeDesktopLyricsNextColor}
```

- [ ] **Step 6: Run test and verify it passes**

Run:

```bash
npm test -- src/renderer/App.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit App wiring**

Run:

```bash
git add src/renderer/App.tsx src/renderer/App.test.tsx
git commit -m "feat: sync desktop lyric colors from settings"
```

Expected: commit succeeds.

## Task 5: CSS And Style Constraints

**Files:**
- Modify: `src/renderer/styles.css`
- Modify: `src/renderer/styles.test.ts`

- [ ] **Step 1: Write failing style tests**

In `src/renderer/styles.test.ts`, add this test near the lyric CSS variable tests:

```ts
  it("scopes desktop lyric colors through CSS variables", async () => {
    const css = await readStyles();

    expect(rule(css, ".desktop-lyrics-current")).toContain("color: var(--desktop-lyrics-current-color");
    expect(rule(css, ".desktop-lyrics-current.loading")).toContain("color: var(--desktop-lyrics-current-color");
    expect(rule(css, ".desktop-lyrics-next")).toContain("color: var(--desktop-lyrics-next-color");
    expect(rule(css, ".desktop-lyrics-preview")).toContain("color: var(--desktop-lyrics-preview-current-color");
    expect(rule(css, ".desktop-lyrics-preview span")).toContain("color: var(--desktop-lyrics-preview-next-color");
  });
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- src/renderer/styles.test.ts
```

Expected: FAIL because the CSS still uses fixed desktop lyric colors.

- [ ] **Step 3: Implement SettingsPage color-control styles**

In `src/renderer/styles.css`, add these rules after `.lyrics-select-control select`:

```css
.lyrics-color-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 180px));
  gap: 10px;
}

.lyrics-color-control {
  display: grid;
  gap: 8px;
  color: #1d1d1f;
}

.lyrics-color-picker {
  width: 100%;
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #d8d8df;
  border-radius: 10px;
  padding: 6px 10px;
  background: white;
}

.lyrics-color-picker input {
  width: 30px;
  height: 26px;
  flex: 0 0 auto;
  border: 0;
  padding: 0;
  background: transparent;
}

.lyrics-color-picker code {
  color: #4b4b52;
  font: 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}
```

In the existing `@media (max-width: 640px)` block, add:

```css
  .lyrics-color-controls {
    grid-template-columns: 1fr;
  }
```

If no `@media (max-width: 640px)` block exists, add this block near the other responsive rules:

```css
@media (max-width: 640px) {
  .lyrics-color-controls {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 4: Apply color CSS variables**

In `src/renderer/styles.css`, update `.desktop-lyrics-preview`:

```css
.desktop-lyrics-preview {
  width: min(520px, 100%);
  padding: 16px 20px;
  color: var(--desktop-lyrics-preview-current-color, #ffffff);
  background: transparent;
  -webkit-text-stroke: 0.8px rgba(0, 0, 0, 0.72);
}
```

Update `.desktop-lyrics-preview span`:

```css
.desktop-lyrics-preview span {
  display: block;
  margin-top: 8px;
  color: var(--desktop-lyrics-preview-next-color, #9ca3af);
  font-size: 0.68em;
}
```

Update `.desktop-lyrics-shell`:

```css
.desktop-lyrics-shell {
  display: inline-grid;
  gap: 8px;
  max-width: 960px;
  padding: 10px 14px;
  color: var(--desktop-lyrics-current-color, #ffffff);
  background: transparent;
  font-family: var(--desktop-lyrics-font-family, ui-sans-serif, system-ui, sans-serif);
  overflow: visible;
  -webkit-text-stroke: 0.8px rgba(0, 0, 0, 0.72);
}
```

Add a color line to `.desktop-lyrics-current`:

```css
  color: var(--desktop-lyrics-current-color, #ffffff);
```

Update `.desktop-lyrics-current.loading`:

```css
.desktop-lyrics-current.loading {
  color: var(--desktop-lyrics-current-color, #ffffff);
}
```

Update `.desktop-lyrics-next`:

```css
.desktop-lyrics-next {
  color: var(--desktop-lyrics-next-color, #9ca3af);
  font-size: calc(var(--desktop-lyrics-font-size, 28px) * 0.68);
}
```

- [ ] **Step 5: Run style tests and verify they pass**

Run:

```bash
npm test -- src/renderer/styles.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run focused renderer tests**

Run:

```bash
npm test -- src/renderer/appSettings.test.ts src/renderer/components/SettingsPage.test.tsx src/renderer/lyrics.test.ts src/renderer/components/DesktopLyrics.test.tsx src/renderer/DesktopLyricsWindow.test.tsx src/renderer/App.test.tsx src/renderer/styles.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit CSS and style constraints**

Run:

```bash
git add src/renderer/styles.css src/renderer/styles.test.ts
git commit -m "feat: style desktop lyric color controls"
```

Expected: commit succeeds.

## Task 6: Final Verification

**Files:**
- Verify all modified source and test files.

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

- [ ] **Step 3: Inspect git status**

Run:

```bash
git status --short
```

Expected: no unstaged source changes. If documentation or generated artifacts are intentionally changed, stage and commit them before handoff.

- [ ] **Step 4: Manual smoke check**

Run the app:

```bash
npm run dev
```

Expected:

- Settings page opens.
- `歌词 > 桌面歌词` shows current lyric and next lyric color pickers.
- Changing each color updates the desktop lyrics preview immediately.
- Enabling desktop lyrics opens the floating transparent lyric window.
- Changing colors while desktop lyrics are enabled updates the floating lyrics without reopening the window.

- [ ] **Step 5: Confirm there are no final verification edits**

Run:

```bash
git diff --exit-code
```

Expected: exit code 0. If the command reports a diff, inspect the diff and either commit the intentional source change with a specific message or revert accidental local edits before handoff.
