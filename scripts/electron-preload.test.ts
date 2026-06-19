// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Electron preload packaging", () => {
  it("loads a CommonJS preload file in packaged builds", async () => {
    const mainSource = await readFile(path.join(process.cwd(), "electron/main.ts"), "utf8");

    expect(mainSource).toContain("preload.cjs");
  });

  it("exposes track context menu and desktop lyrics APIs", async () => {
    const preloadSource = await readFile(path.join(process.cwd(), "electron/preload.cts"), "utf8");
    const mainSource = await readFile(path.join(process.cwd(), "electron/main.ts"), "utf8");

    expect(preloadSource).toContain("showTrackInFolder");
    expect(preloadSource).toContain("updateTrackMetadata");
    expect(preloadSource).toContain("trashTrackLyrics");
    expect(preloadSource).toContain("trashTrackFiles");
    expect(preloadSource).toContain("listSystemFonts");
    expect(preloadSource).toContain("showDesktopLyrics");
    expect(preloadSource).toContain("closeDesktopLyrics");
    expect(preloadSource).toContain("updateDesktopLyrics");
    expect(preloadSource).toContain("resizeDesktopLyrics");
    expect(preloadSource).toContain("onDesktopLyricsUpdate");
    expect(preloadSource).toContain("onDesktopLyricsClosed");
    expect(preloadSource).toContain("openMainSettingsFromDesktopLyrics");
    expect(mainSource).toContain("media:show-track-in-folder");
    expect(mainSource).toContain("media:update-track-metadata");
    expect(mainSource).toContain("media:trash-track-lyrics");
    expect(mainSource).toContain("media:trash-track-files");
    expect(mainSource).toContain("showItemInFolder");
    expect(mainSource).toContain("trashItem");
  });

  it("exposes system media shortcut APIs", async () => {
    const preloadSource = await readFile(path.join(process.cwd(), "electron/preload.cts"), "utf8");
    const mainSource = await readFile(path.join(process.cwd(), "electron/main.ts"), "utf8");

    expect(preloadSource).toContain("setSystemMediaShortcutsEnabled");
    expect(preloadSource).toContain("ensureSystemMediaShortcutsPermission");
    expect(preloadSource).toContain("onMediaKeyCommand");
    expect(preloadSource).toContain("playback:ensure-system-media-shortcuts-permission");
    expect(preloadSource).toContain("playback:set-system-media-shortcuts-enabled");
    expect(preloadSource).toContain("playback:media-key-command");
    expect(mainSource).toContain("systemPreferences");
    expect(mainSource).toContain("isTrustedAccessibilityClient(false)");
    expect(mainSource).toContain("showMessageBox");
    expect(mainSource).toContain("系统设置 > 隐私与安全 > 无障碍");
    expect(mainSource).not.toContain("隐私与安全性 > 辅助功能");
    expect(mainSource).toContain("globalShortcut");
    expect(mainSource).toContain("MediaPlayPause");
    expect(mainSource).toContain("MediaNextTrack");
    expect(mainSource).toContain("MediaPreviousTrack");
    expect(mainSource).toContain("playback:ensure-system-media-shortcuts-permission");
    expect(mainSource).toContain("playback:set-system-media-shortcuts-enabled");
    expect(mainSource).toContain("playback:media-key-command");
  });
});
