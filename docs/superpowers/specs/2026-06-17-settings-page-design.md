# Settings Page Design

## Goal

Add a first settings page to the musicplayer. The page should expose basic library management, reserve space for future playback preferences, and let users change the fullscreen lyrics font size.

## Scope

In scope:

- Add a global Settings entry at the bottom of the sidebar with a gear icon.
- Render Settings as an in-app view in the existing single-page React application.
- Keep the player bar visible while Settings is open.
- Add library actions for choosing a folder, rescanning the current library, and clearing the library cache.
- Add a playback settings section with non-interactive explanatory copy.
- Add a fullscreen lyrics font-size setting that only affects the fullscreen lyrics view.
- Persist settings in `localStorage` with validation and defaults.

Out of scope:

- New browser routing.
- Playback preference controls in the first version.
- Any change to audio files, metadata files, lyrics files, or artwork files.
- Applying lyrics font size to library lists, buttons, headings, or other app text.

## Architecture

The app remains a single-page React application. `App.tsx` adds a top-level view state, for example:

```ts
type AppView = "library" | "settings";
```

The existing `activeCategory` state continues to own library category selection for Songs, Albums, Artists, and Folders. `activeView` decides whether the main stage shows the existing library workspace or the new settings page.

Sidebar behavior:

- Clicking Songs, Albums, Artists, or Folders sets `activeView` to `"library"` and updates `activeCategory`.
- Clicking Settings sets `activeView` to `"settings"`.
- The Settings entry is visually separated near the bottom of the sidebar and uses a `lucide-react` gear icon.
- The current folder path remains visible at the bottom when available.

Main-stage behavior:

- When `activeView === "library"`, the existing scanning, error, warning, empty, library list, and playlist rendering stays unchanged.
- When `activeView === "settings"`, the main stage renders a new `SettingsPage` component.
- The player bar remains mounted in both views so playback is not interrupted.

## Components

### `SettingsPage`

`SettingsPage` is a focused renderer for settings UI. It should receive state and callbacks from `App.tsx` instead of owning application behavior directly.

Suggested props:

```ts
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
```

The component renders three settings sections.

### Library Section

Shows the current music folder path or a short empty state when no folder is selected.

Actions:

- `Choose Folder`: calls the existing `chooseFolder` callback.
- `Rescan Library`: calls the existing `rescan` callback and is disabled when no folder is selected or scanning is already active.
- `Clear Library Cache`: removes only `musicplayer:library-cache`.

Clearing the cache does not remove:

- `musicplayer:last-folder`
- `musicplayer:playback-state`
- the currently loaded in-memory track list
- any music, lyrics, or artwork files

### Playback Section

The first version displays non-interactive explanatory copy such as `Playback preferences will appear here.` It should not render disabled controls for features that are not implemented.

### Lyrics Section

Provides a `Fullscreen lyrics font size` range control.

Behavior:

- Range: `24` to `56`
- Step: `1`
- Default: `36`
- Display the current value as pixels.
- Include a small preview line using the selected size.
- The setting only affects fullscreen lyrics lines and fullscreen lyrics empty/loading text.

## Data Flow

Add a settings storage key:

```ts
const APP_SETTINGS_STORAGE_KEY = "musicplayer:settings";
```

Persist an extensible object:

```ts
interface AppSettings {
  fullscreenLyricsFontSize: number;
}
```

`App.tsx` owns the settings state. On startup it reads `localStorage`, validates the value, and falls back to:

```ts
const DEFAULT_APP_SETTINGS: AppSettings = {
  fullscreenLyricsFontSize: 36
};
```

Validation rules:

- Missing settings use defaults.
- Invalid JSON uses defaults.
- Non-number font sizes use defaults.
- Font sizes below `24` or above `56` use defaults.

When the user moves the slider, `App.tsx` updates state and writes the validated settings object back to `localStorage`.

`App.tsx` passes `fullscreenLyricsFontSize` to `FullscreenLyrics`. `FullscreenLyrics` applies the value through a CSS custom property or equivalent local style so the change is scoped to the fullscreen lyrics view.

## Error Handling

Existing folder selection and rescan errors continue to use the current app-level error surface.

Cache clearing uses a local status line in Settings:

- On success, show a short confirmation such as `Library cache cleared.`
- If `localStorage.removeItem` throws, show an inline error such as `Unable to clear the library cache.`

Settings storage read failures fall back silently to defaults so a corrupted local setting does not block app startup. Settings write failures should leave the in-memory value active for the current session and may show an inline settings error if surfaced in the implementation.

## Styling

The settings page follows the existing desktop app style:

- White content panels with the same restrained shadow language as library and playlist panels.
- Compact groups and clear labels.
- Existing button styling where practical (`primary-button`, `secondary-button`, icon buttons).
- `lucide-react` icons for the Settings sidebar entry and any obvious action icons.
- No nested cards. Sections can be full-width groups within the settings page.

The page should stay usable at the current responsive breakpoints. The sidebar is already hidden on narrow screens, so this first design does not add a separate mobile settings entry.

## Testing

Add focused tests for:

- Sidebar Settings entry switches the main stage to the settings page.
- Clicking a library category switches back to the library view.
- Settings shows the current folder path when available.
- `Rescan Library` is disabled when there is no selected folder.
- `Clear Library Cache` removes only `musicplayer:library-cache` and preserves last-folder and playback-state keys.
- Fullscreen lyrics font size changes persist to `localStorage`.
- Fullscreen lyrics receives and applies the configured font size.
- Invalid persisted settings values fall back to the default font size.

Existing tests around startup cache, playback restoration, playlist behavior, context menus, and fullscreen lyrics should continue to pass.
