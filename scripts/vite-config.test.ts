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
