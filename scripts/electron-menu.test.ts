// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Electron application menu", () => {
  it("exposes folder actions through the application menu", async () => {
    const mainSource = await readFile(path.join(process.cwd(), "electron/main.ts"), "utf8");

    expect(mainSource).toContain("Menu");
    expect(mainSource).toContain("选择文件夹");
    expect(mainSource).toContain("重新扫描音乐库");
    expect(mainSource).toContain("library:menu-command");
    expect(mainSource).toContain("setApplicationMenu");
  });

  it("uses the project app icon for Electron windows", async () => {
    const mainSource = await readFile(path.join(process.cwd(), "electron/main.ts"), "utf8");

    expect(mainSource).toContain("app-icon.png");
    expect(mainSource).toContain("icon:");
  });
});
