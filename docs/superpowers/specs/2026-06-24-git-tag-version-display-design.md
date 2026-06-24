# Git Tag Version Display Design

## Goal

Show the application version in Settings. The displayed version must come from the latest Git tag, not from `package.json`.

## Scope

In scope:

- Add a compact app information area at the bottom of the existing Settings page.
- Display the version as `版本 vX.Y.Z` when a Git tag is available.
- Resolve the version during the Vite config phase with `git describe --tags --abbrev=0`.
- Inject the resolved value into the renderer as a build-time constant.
- Fall back to `unknown` when Git or tags are unavailable so local builds do not fail.

Out of scope:

- Showing the version in the sidebar or player bar.
- Changing `package.json` versioning.
- Adding update checks, release notes, or links to GitHub releases.
- Reading Git metadata at runtime from Electron main or preload.

## Recommended Approach

Use Vite `define` to inject a renderer constant such as `__APP_VERSION__`.

This keeps version resolution in the build layer where Git is available and avoids adding Electron IPC only for static metadata. It also preserves the renderer's current component data flow: `App.tsx` can pass the value into `SettingsPage`, and `SettingsPage` remains a simple renderer.

Alternatives considered:

- Reading `package.json` would be simple, but it does not meet the requirement because the version must be the Git tag.
- Reading Git tags from Electron at runtime would work in development, but packaged apps usually do not ship `.git`, so the value would be less reliable.
- Showing the version in the sidebar would make it more visible, but the user selected Settings as the display location.

## Data Flow

`vite.config.ts` resolves the version once while the config is loaded:

```ts
git describe --tags --abbrev=0
```

The result is trimmed and injected with Vite `define`. If the command fails, returns an empty string, or no tag exists, the injected value is `unknown`.

The renderer declares the build-time constant in `src/vite-env.d.ts` so TypeScript understands it.

`App.tsx` passes the constant to `SettingsPage`:

```tsx
<SettingsPage appVersion={__APP_VERSION__} ... />
```

`SettingsPage` renders the value in a small bottom section:

```tsx
版本 v1.6.0
```

## UI

The Settings page gains a final section after existing settings groups. It should be visually quiet and scan like app metadata, not a primary control area.

Suggested content:

- Heading: `关于`
- Row label: `版本`
- Row value: the injected version string

The section uses existing Settings page layout primitives and CSS. No nested cards or new navigation are needed.

## Error Handling

Version resolution happens at build time. Failures should not block development or release builds.

Fallback behavior:

- Git command unavailable: `unknown`
- No tags in repository: `unknown`
- Empty command output: `unknown`

Runtime renderer code does not need error handling because it receives a static string.

## Testing

Add focused tests for:

- `SettingsPage` renders the supplied app version in the Settings page.
- `vite.config.ts` contains a tested helper for resolving the Git tag version.
- The helper returns the trimmed tag when the Git command succeeds.
- The helper returns `unknown` when the Git command fails or returns empty output.

Existing Settings page tests should continue to pass.
