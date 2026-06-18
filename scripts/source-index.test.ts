// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("source index.html", () => {
  it("keeps the Vite source entry instead of committed build assets", async () => {
    const source = await readFile(path.join(process.cwd(), "index.html"), "utf8");

    expect(source).toContain('/src/renderer/main.tsx');
    expect(source).not.toContain("./assets/");
  });

  it("declares the project favicon source", async () => {
    const source = await readFile(path.join(process.cwd(), "index.html"), "utf8");

    expect(source).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
  });
});
