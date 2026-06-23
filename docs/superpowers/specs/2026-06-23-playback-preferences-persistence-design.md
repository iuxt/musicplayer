# Playback Preferences Persistence Design

## Goal

Persist playback preferences that users expect to survive app restarts:

- Volume
- Shuffle
- Repeat mode

The existing desktop lyrics switch and other settings already persist through `musicplayer:settings`; this change extends that same settings object instead of adding another storage key.

## Scope

In scope:

- Add `volume`, `shuffle`, and `repeat` to renderer `AppSettings`.
- Read these values at startup and use them as the initial audio player preferences.
- Persist changes when the user adjusts volume or cycles playback mode.
- Keep backward compatibility with older saved settings that do not include these fields.
- Validate persisted values so corrupt settings cannot break startup.

Out of scope:

- Changing the playback progress restore format in `musicplayer:playback-state`.
- Persisting whether audio was playing and autoplaying on startup.
- Adding new settings page controls for shuffle or repeat.
- Moving settings persistence into the Electron main process.

## Recommended Approach

Extend the existing `musicplayer:settings` object. Playback volume and playback mode are user preferences, so they fit beside the already persisted settings for lyrics, system media shortcuts, and window-close playback behavior.

Alternative storage approaches were considered:

- A new `musicplayer:playback-preferences` key would separate concerns, but it would add another persistence path while the current settings utility is already responsible for validated user preferences.
- Adding these fields to `musicplayer:playback-state` would mix durable preferences with the current-track snapshot and make future cache clearing or playback-state migration more fragile.

## Settings Model

`AppSettings` gains these fields:

```ts
volume: number;
shuffle: boolean;
repeat: "off" | "all" | "one";
```

Defaults:

```ts
volume: 0.82;
shuffle: false;
repeat: "off";
```

Validation:

- Missing fields use defaults so legacy settings migrate cleanly.
- `volume` must be a finite number between `0` and `1`.
- `shuffle` must be a boolean.
- `repeat` must be one of `"off"`, `"all"`, or `"one"`.
- If an explicitly persisted field has an invalid type or value, settings fall back to defaults, matching the existing conservative validation style.

## Audio Player Flow

`App.tsx` remains the owner of settings persistence. It reads settings on startup with `readAppSettings()` and passes the relevant values into `useAudioPlayer`.

`useAudioPlayer` accepts initial playback preferences:

```ts
useAudioPlayer(queue, {
  volume: appSettings.volume,
  shuffle: appSettings.shuffle,
  repeat: appSettings.repeat
});
```

The hook uses those values to initialize React state. When the underlying `Audio` instance is created, its `volume` is set from the persisted volume.

The hook does not read or write `localStorage`; it stays focused on playback behavior.

## Persistence Flow

`App.tsx` wraps the player callbacks that mutate persisted preferences:

- `onVolume` calls `player.setVolume(nextVolume)` and commits `{ volume: nextVolume }` to `AppSettings`.
- `onPlaybackMode` calls a player method that returns or reports the next shuffle/repeat state, then commits `{ shuffle, repeat }` to `AppSettings`.

If the implementation keeps `cyclePlaybackMode` as a void callback, `useAudioPlayer` can also expose a focused callback option such as `onPlaybackPreferencesChange`. The important boundary is that storage writes still happen in `App.tsx`, not inside the hook.

Existing menu and media-key playback actions continue to call the player directly. They do not change volume, shuffle, or repeat.

## UI Behavior

No new UI is required.

- The existing volume slider displays the restored volume on startup.
- The existing playback-mode button displays restored shuffle or repeat state on startup.
- Cycling the playback-mode button continues through the existing sequence: shuffle, repeat all, repeat one, off.
- Existing labels and icons stay unchanged.

## Error Handling

Settings read errors and invalid JSON continue to fall back silently to defaults.

Settings write failures should preserve the in-memory player state for the current session and surface the existing app-level error message path used by other setting writes.

## Testing

Use TDD with focused tests:

- `appSettings` reads and writes valid `volume`, `shuffle`, and `repeat` values.
- `appSettings` migrates legacy settings by filling missing playback preference fields with defaults.
- `appSettings` rejects invalid persisted playback preference values.
- `useAudioPlayer` initializes its state and the created `Audio` element from supplied playback preferences.
- `useAudioPlayer` continues cycling playback mode through shuffle, repeat all, repeat one, and off.
- `App` restores saved volume into the player bar volume slider.
- `App` persists volume changes to `musicplayer:settings`.
- `App` restores saved shuffle/repeat state into the playback-mode button.
- `App` persists playback-mode changes to `musicplayer:settings`.

Existing tests for desktop lyrics settings, playback progress restore, system media shortcuts, and close-window playback behavior should continue to pass.
