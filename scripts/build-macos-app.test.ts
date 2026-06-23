import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ELECTRON_MIRROR,
  formatBuildError,
  getBuildPaths,
  getInstallCommand,
  getPackagerOptions,
  normalizeDarwinArch,
  runPackagerWithElectronMirrorRetry
} from "./build-macos-app.mjs";

describe("build-macos-app helpers", () => {
  it("normalizes Node architecture names for Electron packaging", () => {
    expect(normalizeDarwinArch("arm64")).toBe("arm64");
    expect(normalizeDarwinArch("x64")).toBe("x64");
  });

  it("creates deterministic staging and Applications paths outside the repo", () => {
    const paths = getBuildPaths("/repo", "arm64", "/tmp/musicplayer-build");

    expect(paths.appName).toBe("音乐播放器");
    expect(paths.projectReleaseDir).toBe(path.join("/repo", "release"));
    expect(paths.stagingDir).toBe("/tmp/musicplayer-build");
    expect(paths.packagedAppPath).toBe(path.join("/tmp/musicplayer-build", "音乐播放器-darwin-arm64", "音乐播放器.app"));
    expect(paths.applicationsPath).toBe(path.join("/Applications", "音乐播放器.app"));
  });

  it("installs app bundles with ditto to preserve relative symlinks", () => {
    const command = getInstallCommand("/tmp/App.app", "/Applications/App.app");

    expect(command).toEqual({
      command: "ditto",
      args: ["/tmp/App.app", "/Applications/App.app"]
    });
  });

  it("passes the custom macOS app icon to Electron Packager", () => {
    const paths = getBuildPaths("/repo", "arm64", "/tmp/musicplayer-build");
    const options = getPackagerOptions("/repo", paths, "arm64");

    expect(options.icon).toBe(path.join("/repo", "build", "app-icon.icns"));
  });

  it("suppresses optional macOS .icon format warnings during local install packaging", () => {
    const paths = getBuildPaths("/repo", "arm64", "/tmp/musicplayer-build");
    const options = getPackagerOptions("/repo", paths, "arm64");

    expect(options.quiet).toBe(true);
  });

  it("retries Electron packaging with a mirror when the default download fetch fails", async () => {
    const attempts: unknown[] = [];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      await expect(
        runPackagerWithElectronMirrorRetry(
          { quiet: true },
          async (options) => {
            attempts.push(options);

            if (attempts.length === 1) {
              throw new TypeError("fetch failed");
            }

            return ["/tmp/音乐播放器.app"];
          },
          DEFAULT_ELECTRON_MIRROR
        )
      ).resolves.toEqual(["/tmp/音乐播放器.app"]);
    } finally {
      warn.mockRestore();
    }

    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toMatchObject({
      download: {
        mirrorOptions: {
          mirror: DEFAULT_ELECTRON_MIRROR
        }
      }
    });
  });

  it("formats build failures with the original stack and Electron download hint", () => {
    const error = new TypeError("fetch failed");
    error.stack = "TypeError: fetch failed\n    at downloadElectronZip";

    expect(formatBuildError(error)).toContain("TypeError: fetch failed\n    at downloadElectronZip");
    expect(formatBuildError(error)).toContain("ELECTRON_MIRROR");
  });
});
