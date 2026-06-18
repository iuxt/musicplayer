// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("release packaging workflow", () => {
  it("builds Linux, macOS, and Windows installers when a version tag is pushed", async () => {
    const workflow = await readFile(path.join(process.cwd(), ".github", "workflows", "release.yml"), "utf8");

    expect(workflow).toContain("tags:");
    expect(workflow).toContain("v*");
    expect(workflow).toContain("ubuntu-latest");
    expect(workflow).toContain("macos-latest");
    expect(workflow).toContain("windows-latest");
    expect(workflow).toContain("npm run dist:linux");
    expect(workflow).toContain("sudo apt-get install -y rpm");
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
    expect(packageJson.scripts?.["dist:linux"]).toContain("electron-builder --linux");
    expect(packageJson.scripts?.["dist:win"]).toContain("electron-builder --win");
    expect(packageJson.devDependencies?.["electron-builder"]).toBeTruthy();
    expect(packageJson.build).toMatchObject({
      directories: {
        output: "release"
      }
    });
  });

  it("packages Linux as AppImage, deb, and rpm while avoiding zip installers", async () => {
    const packageJson = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8")) as {
      build?: {
        linux?: {
          maintainer?: unknown;
          target?: unknown;
        };
        mac?: {
          target?: unknown;
        };
        win?: {
          target?: unknown;
        };
      };
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["dist:linux"]).toBe("npm run build && electron-builder --linux AppImage deb rpm --x64 --publish never");
    expect(packageJson.scripts?.["dist:mac"]).toBe("npm run build && electron-builder --mac dmg --publish never");
    expect(packageJson.scripts?.["dist:win"]).toBe("npm run build && electron-builder --win nsis --x64 --publish never");
    expect(packageJson.build?.linux?.maintainer).toBe("Musicplayer Maintainers <maintainers@musicplayer.local>");
    expect(packageJson.build?.linux?.target).toEqual([
      {
        target: "AppImage",
        arch: ["x64"]
      },
      {
        target: "deb",
        arch: ["x64"]
      },
      {
        target: "rpm",
        arch: ["x64"]
      }
    ]);
    expect(packageJson.build?.mac?.target).toEqual(["dmg"]);
    expect(packageJson.build?.win?.target).toEqual([
      {
        target: "nsis",
        arch: ["x64"]
      }
    ]);
  });

  it("uploads only requested installer artifact extensions", async () => {
    const workflow = await readFile(path.join(process.cwd(), ".github", "workflows", "release.yml"), "utf8");

    expect(workflow).toContain("release/*.AppImage");
    expect(workflow).toContain("release/*.deb");
    expect(workflow).toContain("release/*.rpm");
    expect(workflow).toContain("release/*.dmg");
    expect(workflow).toContain("release/*.exe");
    expect(workflow).not.toContain(".zip");
  });
});
