import { describe, expect, it, vi } from "vitest";
import {
  FALLBACK_SYSTEM_FONTS,
  listSystemFonts,
  normalizeFontNames,
  parseFcListOutput,
  parseMacFontOutput
} from "./systemFonts.js";

describe("systemFonts", () => {
  it("normalizes, deduplicates, and sorts font names", () => {
    expect(normalizeFontNames([" PingFang SC ", "", "Arial", "PingFang SC"])).toEqual(["Arial", "PingFang SC"]);
  });

  it("parses macOS system_profiler JSON font output", () => {
    const output = JSON.stringify({
      SPFontsDataType: [
        { family: "PingFang SC" },
        { typefaces: [{ family: "LXGW WenKai" }, { family: "PingFang SC" }] }
      ]
    });

    expect(parseMacFontOutput(output)).toEqual(["LXGW WenKai", "PingFang SC"]);
  });

  it("filters hidden dot-prefixed font names", () => {
    expect(normalizeFontNames([".Apple Symbols Fallback", " PingFang SC ", ".SF NS"])).toEqual(["PingFang SC"]);
  });

  it("parses Linux fc-list output", () => {
    expect(parseFcListOutput("Noto Sans CJK SC\nArial\nNoto Sans CJK SC\n")).toEqual(["Arial", "Noto Sans CJK SC"]);
  });

  it("returns fallback fonts when enumeration fails", async () => {
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(new Error("missing command"), "");
    });

    await expect(listSystemFonts({ platform: "linux", execFile })).resolves.toEqual(FALLBACK_SYSTEM_FONTS);
  });
});
