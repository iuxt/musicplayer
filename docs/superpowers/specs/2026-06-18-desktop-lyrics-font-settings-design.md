# Desktop Lyrics And Lyric Font Settings Design

## Goal

Add desktop lyrics to the settings page and let users customize lyric fonts independently for fullscreen lyrics and desktop lyrics.

The desktop lyrics feature should behave like a real floating desktop lyric window: transparent, always on top, draggable, closeable, and restored on app startup when the setting remains enabled.

## Confirmed Decisions

- Desktop lyrics use a floating transparent Electron window, not an in-app overlay.
- The window default style is a two-line translucent glass panel that shows the current lyric line and the next lyric line.
- The window is draggable, closeable, and shows controls on hover.
- The window does not use mouse passthrough or lock mode in the first version.
- Fullscreen lyrics and desktop lyrics have independent font family and font size settings.
- Font selection uses a system font list when available, with safe fallback font options if enumeration fails.
- `desktopLyricsEnabled` is persisted. If it is still enabled on startup, the app restores the desktop lyrics window.

## Scope

In scope:

- Extend the existing app settings model for independent fullscreen and desktop lyric typography.
- Add system font listing support through the preload API.
- Add settings controls for fullscreen lyric font family, fullscreen lyric font size, desktop lyric font family, desktop lyric font size, and desktop lyric visibility.
- Add a desktop lyrics Electron window with transparent always-on-top behavior.
- Add a focused `DesktopLyrics` renderer path that only renders the floating lyric surface.
- Share lyric parsing and active-line selection between fullscreen and desktop lyrics.
- Keep desktop lyrics synchronized with the current track, lyric loading state, lyric content, playback time, and relevant settings.
- Add tests for settings migration, font settings, desktop lyric payload calculation, settings UI behavior, preload APIs, and Electron window wiring.

Out of scope:

- Mouse passthrough, lock mode, or click-through desktop lyrics.
- Per-theme desktop lyric appearance settings beyond the confirmed translucent two-line glass style.
- Persisting exact desktop lyric window position and size.
- Adding a player-bar quick toggle.
- Importing custom `.ttf` or `.otf` files.
- Changing music, metadata, artwork, or lyric files.

## Architecture

The app remains an Electron + React + TypeScript application with the main renderer as the source of truth for playback and settings.

`App.tsx` continues to own:

- current track
- current playback time
- loaded lyrics text
- lyric loading state
- artwork URL
- persisted app settings

Electron main process gains a small desktop lyrics window manager. It creates at most one `BrowserWindow` for desktop lyrics, configured as transparent, frameless, always on top, and skipped from the taskbar. The main renderer asks the main process to show or close the window through preload IPC.

The desktop lyrics window loads the existing renderer bundle in a dedicated mode, for example through a URL query such as `?window=desktop-lyrics`. The renderer entry checks this mode:

- normal mode renders the existing `App`
- desktop lyrics mode renders `DesktopLyricsWindow`

This avoids creating a separate Vite build while keeping the desktop lyric UI isolated from the main application layout.

## Settings Model

Extend `AppSettings`:

```ts
interface AppSettings {
  fullscreenLyricsFontFamily: string;
  fullscreenLyricsFontSize: number;
  desktopLyricsEnabled: boolean;
  desktopLyricsFontFamily: string;
  desktopLyricsFontSize: number;
}
```

Defaults:

```ts
const DEFAULT_APP_SETTINGS: AppSettings = {
  fullscreenLyricsFontFamily: "",
  fullscreenLyricsFontSize: 36,
  desktopLyricsEnabled: false,
  desktopLyricsFontFamily: "",
  desktopLyricsFontSize: 28
};
```

An empty font family means system default. Existing persisted settings that only contain `fullscreenLyricsFontSize` migrate by preserving that value and filling the new fields with defaults.

Validation rules:

- Font family values must be strings. Non-string values fall back to defaults.
- Font family values are stored as plain font family names, not CSS snippets.
- Fullscreen lyrics font size keeps the existing `24` to `56` range.
- Desktop lyrics font size uses a separate compact range, `18` to `44`.
- Invalid JSON or unreadable storage falls back to defaults.
- Write failures keep the in-memory setting active for the current session and surface the existing settings error path.

## Font Listing

Add a preload API:

```ts
listSystemFonts: () => Promise<string[]>;
```

The main process implements platform-specific font enumeration:

- macOS: use system font metadata commands such as `system_profiler SPFontsDataType -json`, with parsing isolated in a helper.
- Linux: use `fc-list` when available.
- Windows: use a PowerShell or registry-backed query.

The helper normalizes results by trimming names, removing duplicates, sorting by locale-aware comparison, and filtering empty values.

If enumeration fails, the API returns a fallback list such as:

- `""` for system default in the UI
- `PingFang SC`
- `Microsoft YaHei`
- `Noto Sans CJK SC`
- `LXGW WenKai`
- `Arial`
- `Helvetica`

The settings page should stay usable while fonts are loading and after a font-list failure.

## Components

### `SettingsPage`

The lyrics section becomes two compact groups:

- Fullscreen lyrics
- Desktop lyrics

Fullscreen lyrics controls:

- font family select
- font size range
- preview line using the selected font family and size

Desktop lyrics controls:

- `显示桌面歌词` toggle
- font family select
- font size range
- preview line using the translucent two-line desktop style

The desktop controls remain visible even when desktop lyrics are disabled, so users can configure appearance before enabling it.

### `FullscreenLyrics`

`FullscreenLyrics` receives both `fullscreenLyricsFontFamily` and `fullscreenLyricsFontSize`. It applies them through scoped CSS custom properties so no other app text is affected.

### `DesktopLyrics`

`DesktopLyrics` renders only the floating lyric surface:

- current lyric line
- next lyric line when available
- loading text when lyrics are loading
- no-lyrics text when the current track has no lyrics
- no-track text when nothing is selected
- hover controls for close and settings

The lyric panel uses `app-region: drag`; hover controls use `app-region: no-drag`.

### Shared Lyric Helpers

Move lyric parsing and active-line lookup out of `FullscreenLyrics` into a shared renderer module, for example `src/renderer/lyrics.ts`.

Export helpers for:

- parsing `.lrc` text into sorted lyric lines
- finding the active lyric line for a playback time
- finding the next lyric line after the active line
- building the desktop lyrics payload from track, lyrics, loading state, playback time, and settings

## Data Flow

When `desktopLyricsEnabled` changes to true:

1. `App.tsx` persists the setting.
2. `App.tsx` calls `window.musicApi.showDesktopLyrics()`.
3. The main process creates or focuses the desktop lyrics window.
4. `App.tsx` sends the latest desktop lyrics payload.

When playback state, lyrics, loading state, current track, or desktop lyrics typography changes:

1. `App.tsx` rebuilds the desktop lyrics payload.
2. If desktop lyrics are enabled, `App.tsx` calls `window.musicApi.updateDesktopLyrics(payload)`.
3. The main process forwards the payload to the desktop lyrics window through `desktop-lyrics:update`.

When the user closes the desktop lyrics window:

1. The desktop lyrics renderer calls `window.musicApi.closeDesktopLyrics()`, or the window emits a close event.
2. The main process closes the desktop lyrics window.
3. The main process sends `desktop-lyrics:closed` to the main window.
4. `App.tsx` updates `desktopLyricsEnabled` to false and persists the setting.

When the user clicks the settings button in the desktop lyrics hover controls:

1. The desktop lyrics renderer calls a preload API such as `openMainSettingsFromDesktopLyrics()`.
2. The main process focuses the main window and sends a command to open the settings view.

## IPC Surface

Add preload APIs:

```ts
showDesktopLyrics: () => Promise<void>;
closeDesktopLyrics: () => Promise<void>;
updateDesktopLyrics: (payload: DesktopLyricsPayload) => Promise<void>;
listSystemFonts: () => Promise<string[]>;
onDesktopLyricsUpdate: (callback: (payload: DesktopLyricsPayload) => void) => () => void;
onDesktopLyricsClosed: (callback: () => void) => () => void;
openMainSettingsFromDesktopLyrics: () => Promise<void>;
```

Add shared types for the desktop lyrics payload:

```ts
interface DesktopLyricsPayload {
  trackTitle: string | null;
  artist: string | null;
  currentLine: string | null;
  nextLine: string | null;
  isLoading: boolean;
  fontFamily: string;
  fontSize: number;
}
```

The payload deliberately excludes full track paths and file paths. The desktop lyrics window only needs display text and styling.

## Window Behavior

Desktop lyrics window defaults:

- width: about `720`
- height: about `130`
- transparent: true
- frame: false
- alwaysOnTop: true
- skipTaskbar: true
- resizable: false for the first version
- backgroundColor: transparent
- contextIsolation: true
- nodeIntegration: false
- same preload security posture as the main window

The first version does not persist position. Electron and the operating system may still remember placement during the same process lifetime, but durable position storage is out of scope.

## Error Handling

- Font enumeration failure returns the fallback font list and does not show a blocking error.
- Desktop lyrics window creation failure disables the in-memory desktop lyrics toggle and shows an app-level error such as `无法打开桌面歌词。`
- Desktop lyrics update failures do not interrupt playback. The app may show a non-blocking error if the window is enabled but unavailable.
- Corrupted settings fall back to defaults.
- Closing the main window closes the desktop lyrics window.
- If the desktop lyrics window is closed externally, the main settings state is synchronized back to disabled.

## Styling

The desktop lyrics visual style follows the confirmed two-line translucent glass direction:

- dark translucent rounded panel
- subtle blur and border
- current line high contrast
- next line smaller and lower contrast
- hover controls hidden until pointer hover
- text wraps safely for long lyrics
- font family and font size come from desktop lyrics settings

Fullscreen lyrics keeps the existing immersive layout and only adds scoped font family support.

## Testing

Add or update focused tests for:

- `readAppSettings` migrates old settings with only `fullscreenLyricsFontSize`.
- invalid new settings fields fall back to defaults.
- settings writes normalized fullscreen and desktop lyric font values.
- `SettingsPage` renders independent fullscreen and desktop font controls.
- system font list success populates selects.
- system font list failure uses fallback options.
- toggling desktop lyrics persists `desktopLyricsEnabled`.
- enabling desktop lyrics calls the preload show/update APIs.
- closing desktop lyrics through the close callback disables and persists the setting.
- `FullscreenLyrics` applies configured font family and size.
- `DesktopLyrics` applies configured font family and size.
- shared lyric helpers return the correct current and next lyric lines.
- Electron preload exposes desktop lyrics and font APIs.
- Electron main source creates a transparent frameless always-on-top desktop lyrics window.
- Electron main source forwards update and close events between windows.

Existing playback, settings, fullscreen lyrics, library cache, and track context menu tests should continue to pass.
