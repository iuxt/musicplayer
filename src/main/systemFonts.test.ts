import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSystemFontsCache,
  FALLBACK_SYSTEM_FONTS,
  listSystemFonts,
  normalizeFontNames,
  parseMacAtsutilFontOutput,
  parseFcListOutput,
  parseMacFontOutput
} from "./systemFonts.js";

describe("systemFonts", () => {
  beforeEach(() => {
    clearSystemFontsCache();
  });

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

  it("parses macOS atsutil family output", () => {
    const output = [
      "System Fonts:",
      "\tPingFangSC-Regular",
      "\tLXGWWenKai-Regular",
      "System Families:",
      "\tPingFang SC",
      "\tLXGW WenKai",
      "User Families:",
      "\tMaple Mono"
    ].join("\n");

    expect(parseMacAtsutilFontOutput(output)).toEqual(["LXGW WenKai", "Maple Mono", "PingFang SC"]);
  });

  it("filters hidden dot-prefixed font names", () => {
    expect(normalizeFontNames([".Apple Symbols Fallback", " PingFang SC ", ".SF NS"])).toEqual(["PingFang SC"]);
  });

  it("parses Linux fc-list output", () => {
    expect(parseFcListOutput("Noto Sans CJK SC\nArial\nNoto Sans CJK SC\n")).toEqual(["Arial", "Noto Sans CJK SC"]);
  });

  it("uses fast macOS atsutil font families before system_profiler", async () => {
    const execFile = vi.fn((command, _args, _options, callback) => {
      if (command === "atsutil") {
        callback(null, "System Fonts:\n\tPingFangSC-Regular\nSystem Families:\n\tPingFang SC\n\tLXGW WenKai\n");
        return;
      }

      callback(null, JSON.stringify({ SPFontsDataType: [{ family: "Slow Fallback" }] }));
    });

    await expect(listSystemFonts({ platform: "darwin", execFile })).resolves.toEqual(["", "LXGW WenKai", "PingFang SC"]);
    expect(execFile).toHaveBeenCalledTimes(1);
  });

  it("caches system font enumeration when requested", async () => {
    const execFile = vi.fn((_command, _args, _options, callback) => {
      callback(null, "Arial\n");
    });

    await expect(listSystemFonts({ platform: "linux", execFile, cache: true })).resolves.toEqual(["", "Arial"]);
    await expect(listSystemFonts({ platform: "linux", execFile, cache: true })).resolves.toEqual(["", "Arial"]);

    expect(execFile).toHaveBeenCalledTimes(1);
  });

  it("returns fallback fonts when enumeration fails", async () => {
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(new Error("missing command"), "");
    });

    await expect(listSystemFonts({ platform: "linux", execFile })).resolves.toEqual(FALLBACK_SYSTEM_FONTS);
  });
});
