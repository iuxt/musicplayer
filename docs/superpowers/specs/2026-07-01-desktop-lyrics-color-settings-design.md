# Desktop Lyrics Color Settings Design

## Goal

Add desktop lyric color settings so users can customize the current desktop lyric line and the next lyric line independently.

The feature should fit the existing settings page and desktop lyrics implementation. It should persist choices, update the settings preview immediately, and synchronize the active desktop lyrics window without adding a separate main-process settings store.

## Confirmed Decisions

- Current desktop lyric line color and next lyric line color are configured separately.
- Color values use standard opaque hex colors in `#RRGGBB` format.
- Alpha/opacity controls are out of scope.
- The settings UI uses a compact two-column layout in the existing desktop lyrics settings group.
- Each color setting uses the native color picker through `<input type="color">`.
- The UI also shows the current hex value beside each color picker.
- Defaults are:
  - current lyric color: `#FFFFFF`
  - next lyric color: `#9CA3AF`
- Desktop lyrics keep the existing transparent text-only window behavior and glyph outline.

## Scope

In scope:

- Extend app settings with `desktopLyricsCurrentColor` and `desktopLyricsNextColor`.
- Validate, normalize, persist, and migrate the new color settings through the existing `appSettings` module.
- Add current-line and next-line color controls to the desktop lyrics settings group.
- Apply selected colors to the desktop lyrics settings preview.
- Include selected colors in `DesktopLyricsPayload`.
- Apply selected colors in the floating desktop lyrics window through scoped CSS custom properties.
- Update focused unit tests around settings normalization, settings UI behavior, payload building, desktop lyrics rendering, and CSS constraints.

Out of scope:

- Transparency controls or `rgba()` colors.
- Color presets or a custom color-picker popover.
- Fullscreen lyric color customization.
- Desktop lyric background, shadow, outline, opacity, lock mode, or click-through changes.
- Main-process settings persistence beyond forwarding the existing desktop lyrics payload.

## Architecture

The existing renderer-owned settings flow remains the source of truth:

1. `App.tsx` reads `AppSettings` from `localStorage`.
2. `SettingsPage` receives desktop lyrics settings as props.
3. User changes are committed through `commitAppSettings`.
4. `buildDesktopLyricsPayload` combines playback, lyrics, typography, and color settings.
5. `App.tsx` sends the payload through the existing `updateDesktopLyrics` IPC when desktop lyrics are enabled.
6. `DesktopLyricsWindow` receives the payload and renders `DesktopLyrics`.

No new IPC channel is needed. The current `updateDesktopLyrics` payload expands to include the two color values.

## Settings Model

Extend `AppSettings`:

```ts
interface AppSettings {
  desktopLyricsCurrentColor: string;
  desktopLyricsNextColor: string;
}
```

Defaults:

```ts
const DEFAULT_APP_SETTINGS = {
  desktopLyricsCurrentColor: "#FFFFFF",
  desktopLyricsNextColor: "#9CA3AF"
};
```

Validation rules:

- Valid values must be strings matching `#[0-9A-Fa-f]{6}`.
- Values are normalized to uppercase `#RRGGBB` before storage or use.
- Missing color fields in legacy settings are filled from defaults.
- Invalid explicit color fields cause `normalizeAppSettings` to return the full default settings object, matching the module's current strict behavior for invalid persisted fields.
- Storage read failures, invalid JSON, and write failures continue to use the existing error handling behavior.

## Settings UI

The existing `SettingsPage` desktop lyrics group keeps this order:

1. `显示桌面歌词` toggle
2. font family select
3. font size select
4. current lyric color picker
5. next lyric color picker
6. desktop lyrics preview

The color controls use the selected compact layout:

- Two controls appear side by side when space allows.
- Each control has a text label, native color input, and visible hex value.
- On narrow widths, the controls can wrap to one column through normal responsive CSS.

The desktop lyrics preview applies:

- current preview line color from `desktopLyricsCurrentColor`
- next preview line color from `desktopLyricsNextColor`
- existing font family, font size, transparent background, and glyph outline

Controls remain visible while desktop lyrics are disabled so users can configure appearance before enabling the window.

## Desktop Lyrics Rendering

Extend `DesktopLyricsPayload`:

```ts
interface DesktopLyricsPayload {
  currentColor: string;
  nextColor: string;
}
```

`DesktopLyrics` maps payload colors to CSS variables:

- `--desktop-lyrics-current-color`
- `--desktop-lyrics-next-color`

CSS uses those variables for:

- `.desktop-lyrics-current`
- `.desktop-lyrics-current.loading`
- `.desktop-lyrics-next`

The component keeps the existing text-only surface:

- transparent background
- no controls
- no text shadow
- glyph outline remains enabled
- only the lyric text remains draggable
- window resizing still uses the rendered text bounds

## Data Flow

When a user changes a desktop lyric color:

1. `SettingsPage` calls the relevant color change callback with the selected `#RRGGBB` value.
2. `App.tsx` updates `AppSettings` through `commitAppSettings`.
3. `writeAppSettings` stores the normalized uppercase color.
4. The settings preview re-renders with the new color.
5. `desktopLyricsPayload` is rebuilt because the relevant color setting changed.
6. If desktop lyrics are enabled, `App.tsx` sends the updated payload through `window.musicApi.updateDesktopLyrics`.
7. The floating desktop lyrics window receives the payload and applies the new CSS variables.

If desktop lyrics are disabled, the setting is still persisted and the preview still updates. The next time desktop lyrics are enabled, the payload includes the saved colors.

## Error Handling

Native color inputs should only emit valid opaque hex colors in normal use. Persisted data can still be malformed, so settings normalization validates all color values before use.

For malformed persisted color values, the app falls back to `DEFAULT_APP_SETTINGS`. This avoids passing invalid CSS into the desktop lyrics window and stays consistent with the current strict settings validation pattern.

If saving settings throws, `commitAppSettings` keeps the in-memory setting for the current session and uses the existing app error path.

## Testing

Update `appSettings.test.ts` to cover:

- default color values
- legacy settings without color fields
- valid color read/write and uppercase normalization
- invalid explicit color values falling back to defaults
- normalized writes trimming font fields while preserving normalized colors

Update `SettingsPage.test.tsx` to cover:

- current lyric and next lyric color controls render as color inputs
- changing each color calls its callback
- the desktop lyrics preview receives the selected colors

Update `lyrics.test.ts` to cover:

- `buildDesktopLyricsPayload` includes `currentColor` and `nextColor` in normal, loading, no-lyrics, and no-track states

Update `DesktopLyrics.test.tsx` to cover:

- the desktop lyrics shell exposes typography and color CSS variables from the payload
- current and next lyric lines still render with configured typography

Update `DesktopLyricsWindow.test.tsx` as needed for the initial payload shape.

Update `styles.test.ts` to cover:

- desktop lyric current and next lines use color CSS variables
- existing constraints remain intact: transparent background, no text shadow, glyph outline, and text-only drag region

Run verification with:

```sh
npm test -- --run src/renderer/appSettings.test.ts src/renderer/components/SettingsPage.test.tsx src/renderer/lyrics.test.ts src/renderer/components/DesktopLyrics.test.tsx src/renderer/DesktopLyricsWindow.test.tsx src/renderer/styles.test.ts
npm run typecheck
```
