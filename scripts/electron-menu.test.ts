// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Electron application menu", () => {
  it("exposes folder actions through the application menu", async () => {
    const mainSource = await readFile(path.join(process.cwd(), "electron/main.ts"), "utf8");

    expect(mainSource).toContain("Menu");
    expect(mainSource).toContain("Choose Folder");
    expect(mainSource).toContain("Rescan Library");
    expect(mainSource).toContain("library:menu-command");
    expect(mainSource).toContain("setApplicationMenu");
  });
});
