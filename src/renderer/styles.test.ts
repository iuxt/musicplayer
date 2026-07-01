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

  it("reserves the top chrome as an Electron drag region", async () => {
    const css = await readStyles();

    expect(rule(css, ".window-drag-region")).toContain("-webkit-app-region: drag");
    expect(rule(css, ".window-drag-region")).toContain("user-select: none");
    expect(rule(css, ".window-drag-region")).toContain("position: fixed");
  });

  it("keeps the central play button circular inside the transport row", async () => {
    const css = await readStyles();

    expect(rule(css, ".play-button")).toContain("aspect-ratio: 1");
    expect(rule(css, ".play-button")).toContain("flex: 0 0 50px");
    expect(rule(css, ".play-button")).toContain("border-radius: 999px");
  });

  it("lets the narrow player bar use its full stacked height", async () => {
    const css = await readStyles();

    expect(mediaRule(css, "@media (max-width: 980px)", ".app-frame")).toContain(
      "grid-template-rows: minmax(0, 1fr) auto"
    );
  });

  it("stacks the player bar before desktop columns can clip the transport controls", async () => {
    const css = await readStyles();

    expect(mediaRule(css, "@media (max-width: 1260px)", ".player-bar")).toContain("grid-template-columns: 1fr");
    expect(mediaRule(css, "@media (max-width: 1260px)", ".player-bar")).toContain("height: auto");
  });

  it("keeps long fullscreen lyrics scrollable inside the viewport", async () => {
    const css = await readStyles();

    expect(rule(css, ".fullscreen-lyrics")).toContain("height: 100dvh");
    expect(rule(css, ".fullscreen-lyrics")).toContain("overflow: hidden");
    expect(rule(css, ".fullscreen-lyrics-column")).toContain("min-height: 0");
    expect(rule(css, ".fullscreen-lyrics-column")).toContain("max-height: calc(100dvh - clamp(68px, 12vw, 164px))");
    expect(rule(css, ".fullscreen-lyrics-column")).toContain("overflow-y: auto");
  });

  it("stacks fullscreen artwork and lyrics without overlap on narrow screens", async () => {
    const css = await readStyles();

    expect(mediaRule(css, "@media (max-width: 980px)", ".fullscreen-lyrics")).toContain("align-items: start");
    expect(mediaRule(css, "@media (max-width: 980px)", ".fullscreen-lyrics")).toContain("grid-auto-rows: max-content");
  });

  it("scopes lyric font families through CSS variables", async () => {
    const css = await readStyles();

    expect(rule(css, ".fullscreen-lyric-line")).toContain("font-family: var(--fullscreen-lyrics-font-family");
    expect(rule(css, ".fullscreen-lyrics-empty")).toContain("font-family: var(--fullscreen-lyrics-font-family");
    expect(rule(css, ".desktop-lyrics-shell")).toContain("font-family: var(--desktop-lyrics-font-family");
  });

  it("scopes desktop lyric colors through CSS variables", async () => {
    const css = await readStyles();

    expect(rule(css, ".desktop-lyrics-current")).toContain("color: var(--desktop-lyrics-current-color");
    expect(rule(css, ".desktop-lyrics-current.loading")).toContain("color: var(--desktop-lyrics-current-color");
    expect(rule(css, ".desktop-lyrics-next")).toContain("color: var(--desktop-lyrics-next-color");
    expect(rule(css, ".desktop-lyrics-preview")).toContain("color: var(--desktop-lyrics-preview-current-color");
    expect(rule(css, ".desktop-lyrics-preview span")).toContain("color: var(--desktop-lyrics-preview-next-color");
  });

  it("makes only the desktop lyric text draggable", async () => {
    const css = await readStyles();

    expect(rule(css, ".desktop-lyrics-shell")).not.toContain("-webkit-app-region: drag");
    expect(rule(css, ".desktop-lyrics-text")).toContain("-webkit-app-region: drag");
    expect(rule(css, ".desktop-lyrics-controls")).toBe("");
    expect(rule(css, ".desktop-lyrics-control")).toBe("");
  });

  it("shows desktop lyrics as text without a framed background", async () => {
    const css = await readStyles();
    const shell = rule(css, ".desktop-lyrics-shell");

    expect(shell).toContain("background: transparent");
    expect(shell).not.toContain("box-shadow");
    expect(shell).not.toContain("backdrop-filter");
    expect(shell).not.toContain("border-radius");
  });

  it("uses glyph outlines instead of blurred shadows for desktop lyrics", async () => {
    const css = await readStyles();
    const shell = rule(css, ".desktop-lyrics-shell");
    const preview = rule(css, ".desktop-lyrics-preview");

    expect(shell).not.toContain("text-shadow");
    expect(preview).not.toContain("text-shadow");
    expect(shell).toContain("-webkit-text-stroke");
    expect(preview).toContain("-webkit-text-stroke");
  });
});

async function readStyles() {
  return readFile(path.join(process.cwd(), "src/renderer/styles.css"), "utf8");
}

function rule(css: string, selector: string) {
  const match = css.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

function mediaRule(css: string, mediaQuery: string, selector: string) {
  const mediaStart = css.indexOf(mediaQuery);
  if (mediaStart === -1) {
    return "";
  }

  const selectorStart = css.indexOf(selector, mediaStart);
  if (selectorStart === -1) {
    return "";
  }

  return rule(css.slice(selectorStart), selector);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
