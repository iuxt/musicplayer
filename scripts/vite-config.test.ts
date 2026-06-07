// @vitest-environment node

import { describe, expect, it } from "vitest";
import config from "../vite.config";

describe("vite config", () => {
  it("uses relative asset paths for packaged file:// loading", () => {
    expect(config).toMatchObject({
      base: "./"
    });
  });
});
