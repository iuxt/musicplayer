// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("release packaging workflow", () => {
  it("builds macOS and Windows installers when a version tag is pushed", async () => {
    const workflow = await readFile(path.join(process.cwd(), ".github", "workflows", "release.yml"), "utf8");

    expect(workflow).toContain("tags:");
    expect(workflow).toContain("v*");
    expect(workflow).toContain("macos-latest");
    expect(workflow).toContain("windows-latest");
    expect(workflow).toContain("softprops/action-gh-release");
    expect(workflow).toContain("contents: write");
  });

  it("defines cross-platform package scripts for installer builds", async () => {
    const packageJson = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8")) as {
      build?: unknown;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["build:electron"]).toContain("node scripts/clean-dist-electron.mjs");
    expect(packageJson.scripts?.["dist:mac"]).toContain("electron-builder --mac");
    expect(packageJson.scripts?.["dist:win"]).toContain("electron-builder --win");
    expect(packageJson.devDependencies?.["electron-builder"]).toBeTruthy();
    expect(packageJson.build).toMatchObject({
      directories: {
        output: "release"
      }
    });
  });
});
