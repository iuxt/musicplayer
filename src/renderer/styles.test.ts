// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("renderer layout styles", () => {
  it("keeps the song list as the main scroll container", async () => {
    const css = await readStyles();

    expect(rule(css, ".app-frame")).toContain("height: 100vh");
    expect(rule(css, ".app-frame")).toContain("grid-template-rows: minmax(0, 1fr) 92px");
    expect(rule(css, ".main-stage")).toContain("overflow: hidden");
    expect(rule(css, ".library-panel")).toContain("min-height: 0");
    expect(rule(css, ".track-list")).toContain("overflow-y: auto");
  });

  it("avoids expensive backdrop blur in the always-visible shell", async () => {
    const css = await readStyles();

    expect(rule(css, ".sidebar")).not.toContain("backdrop-filter");
    expect(rule(css, ".player-bar")).not.toContain("backdrop-filter");
  });

  it("keeps the central play button circular inside the transport row", async () => {
    const css = await readStyles();

    expect(rule(css, ".play-button")).toContain("aspect-ratio: 1");
    expect(rule(css, ".play-button")).toContain("flex: 0 0 50px");
    expect(rule(css, ".play-button")).toContain("border-radius: 999px");
  });
});

async function readStyles() {
  return readFile(path.join(process.cwd(), "src/renderer/styles.css"), "utf8");
}

function rule(css: string, selector: string) {
  const match = css.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
