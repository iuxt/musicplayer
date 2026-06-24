# Git Tag Version Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the latest Git tag version at the bottom of the Settings page.

**Architecture:** Resolve the version in `vite.config.ts` with a small exported helper, inject it into renderer code through Vite `define`, and pass the resulting `__APP_VERSION__` constant from `App.tsx` into `SettingsPage`. `SettingsPage` stays presentational and renders the supplied string in a final app information section.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library.

---

## File Structure

- Modify `vite.config.ts`: add `resolveAppVersion()` and inject `__APP_VERSION__` through `define`.
- Modify `scripts/vite-config.test.ts`: test version helper success, empty output, command failure, and config injection.
- Modify `src/vite-env.d.ts`: declare `__APP_VERSION__` as a global build-time string constant.
- Modify `src/renderer/App.tsx`: pass `__APP_VERSION__` into `SettingsPage`.
- Modify `src/renderer/components/SettingsPage.tsx`: accept `appVersion` and render the final `关于` section.
- Modify `src/renderer/components/SettingsPage.test.tsx`: include `appVersion` in test props and assert that the version is visible.

## Task 1: Vite Version Resolution

**Files:**
- Modify: `vite.config.ts`
- Test: `scripts/vite-config.test.ts`

- [ ] **Step 1: Write failing Vite config tests**

Add tests to `scripts/vite-config.test.ts`:

```ts
// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import config, { resolveAppVersion } from "../vite.config";

describe("vite config", () => {
  it("uses relative asset paths for packaged file:// loading", () => {
    expect(config).toMatchObject({
      base: "./"
    });
  });

  it("injects the git tag app version", () => {
    expect(config.define).toMatchObject({
      __APP_VERSION__: JSON.stringify(resolveAppVersion())
    });
  });

  it("resolves the latest git tag as the app version", () => {
    const execFileSync = vi.fn(() => Buffer.from("v1.6.0\n"));

    expect(resolveAppVersion(execFileSync)).toBe("v1.6.0");
    expect(execFileSync).toHaveBeenCalledWith("git", ["describe", "--tags", "--abbrev=0"], {
      encoding: "utf8"
    });
  });

  it("falls back to unknown for empty git tag output", () => {
    const execFileSync = vi.fn(() => "");

    expect(resolveAppVersion(execFileSync)).toBe("unknown");
  });

  it("falls back to unknown when git tag resolution fails", () => {
    const execFileSync = vi.fn(() => {
      throw new Error("no tags");
    });

    expect(resolveAppVersion(execFileSync)).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run the failing Vite config tests**

Run:

```bash
npm test -- scripts/vite-config.test.ts
```

Expected: FAIL because `resolveAppVersion` is not exported and `config.define` does not include `__APP_VERSION__`.

- [ ] **Step 3: Implement version resolution and injection**

Update `vite.config.ts` to:

```ts
import { execFileSync } from "node:child_process";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

type ExecFileSync = typeof execFileSync;

export function resolveAppVersion(runCommand: ExecFileSync = execFileSync) {
  try {
    const version = String(
      runCommand("git", ["describe", "--tags", "--abbrev=0"], {
        encoding: "utf8"
      })
    ).trim();

    return version || "unknown";
  } catch {
    return "unknown";
  }
}

const appVersion = resolveAppVersion();

export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["node_modules/**", "dist/**", "dist-electron/**"]
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
```

- [ ] **Step 4: Run Vite config tests**

Run:

```bash
npm test -- scripts/vite-config.test.ts
```

Expected: PASS.

## Task 2: Settings Page Version UI

**Files:**
- Modify: `src/vite-env.d.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/SettingsPage.tsx`
- Test: `src/renderer/components/SettingsPage.test.tsx`

- [ ] **Step 1: Write the failing Settings page test**

In `src/renderer/components/SettingsPage.test.tsx`, add this test inside `describe("SettingsPage", () => { ... })`:

```ts
it("shows the app version in the about section", () => {
  render(<SettingsPage {...makeProps({ appVersion: "v1.6.0" })} />);

  expect(screen.getByRole("heading", { name: "关于" })).toBeTruthy();
  expect(screen.getByText("版本")).toBeTruthy();
  expect(screen.getByText("v1.6.0")).toBeTruthy();
});
```

Also update `makeProps()` to include:

```ts
appVersion: "unknown",
```

- [ ] **Step 2: Run the failing Settings page test**

Run:

```bash
npm test -- src/renderer/components/SettingsPage.test.tsx
```

Expected: FAIL because `SettingsPageProps` does not include `appVersion` and no about section is rendered.

- [ ] **Step 3: Declare the build-time version constant**

Add this global declaration inside `declare global` in `src/vite-env.d.ts`:

```ts
const __APP_VERSION__: string;
```

- [ ] **Step 4: Pass the injected version to SettingsPage**

In `src/renderer/App.tsx`, update the SettingsPage usage:

```tsx
<SettingsPage
  folderPath={folderPath}
  isScanning={isScanning}
  availableFontFamilies={availableFontFamilies}
  fullscreenLyricsFontFamily={appSettings.fullscreenLyricsFontFamily}
  fullscreenLyricsFontSize={appSettings.fullscreenLyricsFontSize}
  systemMediaShortcutsEnabled={appSettings.systemMediaShortcutsEnabled}
  closeWindowStopsPlayback={appSettings.closeWindowStopsPlayback}
  desktopLyricsEnabled={appSettings.desktopLyricsEnabled}
  desktopLyricsFontFamily={appSettings.desktopLyricsFontFamily}
  desktopLyricsFontSize={appSettings.desktopLyricsFontSize}
  appVersion={__APP_VERSION__}
  cacheStatus={cacheStatus}
  cacheError={cacheError}
  onChooseFolder={() => {
    void chooseFolder();
  }}
  onRescanLibrary={() => {
    void rescan();
  }}
  onClearLibraryCache={clearLibraryCache}
  onFullscreenLyricsFontFamilyChange={changeFullscreenLyricsFontFamily}
  onFullscreenLyricsFontSizeChange={changeFullscreenLyricsFontSize}
  onSystemMediaShortcutsEnabledChange={changeSystemMediaShortcutsEnabled}
  onCloseWindowStopsPlaybackChange={changeCloseWindowStopsPlayback}
  onDesktopLyricsEnabledChange={changeDesktopLyricsEnabled}
  onDesktopLyricsFontFamilyChange={changeDesktopLyricsFontFamily}
  onDesktopLyricsFontSizeChange={changeDesktopLyricsFontSize}
/>
```

- [ ] **Step 5: Render the about section**

In `src/renderer/components/SettingsPage.tsx`, add the prop:

```ts
appVersion: string;
```

Destructure it from props:

```ts
appVersion,
```

Render this section after the lyrics section and before the closing Settings page tag:

```tsx
<section className="settings-section app-info-section" aria-labelledby="app-info-heading">
  <div className="settings-section-heading">
    <h3 id="app-info-heading">关于</h3>
  </div>
  <div className="setting-row app-version-row">
    <strong>版本</strong>
    <span>{appVersion}</span>
  </div>
</section>
```

- [ ] **Step 6: Run the Settings page test**

Run:

```bash
npm test -- src/renderer/components/SettingsPage.test.tsx
```

Expected: PASS.

## Task 3: Verification

**Files:**
- Verify: `vite.config.ts`
- Verify: `src/vite-env.d.ts`
- Verify: `src/renderer/App.tsx`
- Verify: `src/renderer/components/SettingsPage.tsx`
- Verify: `src/renderer/components/SettingsPage.test.tsx`
- Verify: `scripts/vite-config.test.ts`

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- scripts/vite-config.test.ts src/renderer/components/SettingsPage.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add vite.config.ts scripts/vite-config.test.ts src/vite-env.d.ts src/renderer/App.tsx src/renderer/components/SettingsPage.tsx src/renderer/components/SettingsPage.test.tsx
git commit -m "feat: show git tag version in settings"
```

Expected: commit succeeds with only implementation files included.
