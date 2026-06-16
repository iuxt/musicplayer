import path from "node:path";
import { describe, expect, it } from "vitest";
import { getBuildPaths, getInstallCommand, normalizeDarwinArch } from "./build-macos-app.mjs";

describe("build-macos-app helpers", () => {
  it("normalizes Node architecture names for Electron packaging", () => {
    expect(normalizeDarwinArch("arm64")).toBe("arm64");
    expect(normalizeDarwinArch("x64")).toBe("x64");
  });

  it("creates deterministic staging and Applications paths outside the repo", () => {
    const paths = getBuildPaths("/repo", "arm64", "/tmp/local-music-player-build");

    expect(paths.appName).toBe("Local Music Player");
    expect(paths.projectReleaseDir).toBe(path.join("/repo", "release"));
    expect(paths.stagingDir).toBe("/tmp/local-music-player-build");
    expect(paths.packagedAppPath).toBe(path.join("/tmp/local-music-player-build", "Local Music Player-darwin-arm64", "Local Music Player.app"));
    expect(paths.applicationsPath).toBe(path.join("/Applications", "Local Music Player.app"));
  });

  it("installs app bundles with ditto to preserve relative symlinks", () => {
    const command = getInstallCommand("/tmp/App.app", "/Applications/App.app");

    expect(command).toEqual({
      command: "ditto",
      args: ["/tmp/App.app", "/Applications/App.app"]
    });
  });
});
