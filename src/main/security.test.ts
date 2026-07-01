import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertPathInsideRoot, getTrustedDevServerUrl } from "./security.js";

describe("getTrustedDevServerUrl", () => {
  it("ignores dev server URLs when dev mode is disabled", () => {
    expect(getTrustedDevServerUrl("http://127.0.0.1:5173", false)).toBeNull();
  });

  it("allows loopback http dev server URLs in dev mode", () => {
    expect(getTrustedDevServerUrl("http://127.0.0.1:5173", true)).toBe("http://127.0.0.1:5173/");
    expect(getTrustedDevServerUrl("http://localhost:5173", true)).toBe("http://localhost:5173/");
  });

  it("rejects non-loopback and non-http dev server URLs", () => {
    expect(getTrustedDevServerUrl("https://127.0.0.1:5173", true)).toBeNull();
    expect(getTrustedDevServerUrl("http://example.com/app", true)).toBeNull();
    expect(getTrustedDevServerUrl("file:///tmp/index.html", true)).toBeNull();
    expect(getTrustedDevServerUrl("not a url", true)).toBeNull();
  });
});

describe("assertPathInsideRoot", () => {
  it("returns resolved paths inside the selected library root", () => {
    const root = path.join(os.tmpdir(), "music-library");
    const filePath = path.join(root, "Album", "song.mp3");

    expect(assertPathInsideRoot(filePath, root)).toBe(filePath);
  });

  it("rejects paths outside the selected library root", () => {
    const root = path.join(os.tmpdir(), "music-library");
    const outside = path.join(os.tmpdir(), "other", "song.mp3");

    expect(() => assertPathInsideRoot(outside, root)).toThrow("文件不在当前音乐库中。");
  });
});
