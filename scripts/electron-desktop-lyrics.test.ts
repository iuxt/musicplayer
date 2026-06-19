// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Electron desktop lyrics window", () => {
  it("registers desktop lyrics and font IPC channels", async () => {
    const mainSource = await readFile(path.join(process.cwd(), "electron/main.ts"), "utf8");

    expect(mainSource).toContain("desktop-lyrics:show");
    expect(mainSource).toContain("desktop-lyrics:close");
    expect(mainSource).toContain("desktop-lyrics:update");
    expect(mainSource).toContain("desktop-lyrics:resize");
    expect(mainSource).toContain("desktop-lyrics:open-settings");
    expect(mainSource).toContain("fonts:list-system");
  });

  it("creates a transparent always-on-top desktop lyrics window", async () => {
    const mainSource = await readFile(path.join(process.cwd(), "electron/main.ts"), "utf8");

    expect(mainSource).toContain("transparent: true");
    expect(mainSource).toContain("frame: false");
    expect(mainSource).toContain("alwaysOnTop: true");
    expect(mainSource).toContain("skipTaskbar: true");
    expect(mainSource).toContain("focusable: false");
    expect(mainSource).toContain("desktopLyricsWindow.excludedFromShownWindowsMenu = true");
    expect(mainSource).toContain('title: "桌面歌词"');
    expect(mainSource).toContain("showInactive()");
    expect(mainSource).toContain("window=desktop-lyrics");
    expect(mainSource).toContain("desktopLyricsWindow");
  });

  it("returns to the main window when the app is activated while desktop lyrics exists", async () => {
    const mainSource = await readFile(path.join(process.cwd(), "electron/main.ts"), "utf8");

    expect(mainSource).toContain("function activateMainWindow");
    expect(mainSource).toContain("mainWindow.show()");
    expect(mainSource).toContain("mainWindow.focus()");
    expect(mainSource).toContain("app.on(\"activate\", () => {\n  void activateMainWindow();\n});");
  });
});
