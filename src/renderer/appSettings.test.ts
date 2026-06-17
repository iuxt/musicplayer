import { describe, expect, it, vi } from "vitest";
import {
  APP_SETTINGS_STORAGE_KEY,
  DEFAULT_APP_SETTINGS,
  MAX_FULLSCREEN_LYRICS_FONT_SIZE,
  MIN_FULLSCREEN_LYRICS_FONT_SIZE,
  readAppSettings,
  writeAppSettings
} from "./appSettings";

describe("appSettings", () => {
  it("returns defaults when no settings are saved", () => {
    const storage = makeStorage();

    expect(readAppSettings(storage)).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("returns defaults when storage read throws", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("Storage unavailable");
      }),
      setItem: vi.fn()
    };

    expect(readAppSettings(storage)).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("returns defaults for invalid JSON and out-of-range font sizes", () => {
    expect(readAppSettings(makeStorage({ [APP_SETTINGS_STORAGE_KEY]: "not-json" }))).toEqual(DEFAULT_APP_SETTINGS);
    expect(
      readAppSettings(makeStorage({ [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({ fullscreenLyricsFontSize: 12 }) }))
    ).toEqual(DEFAULT_APP_SETTINGS);
    expect(
      readAppSettings(makeStorage({ [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({ fullscreenLyricsFontSize: 72 }) }))
    ).toEqual(DEFAULT_APP_SETTINGS);
    expect(
      readAppSettings(makeStorage({ [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({ fullscreenLyricsFontSize: "36" }) }))
    ).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("reads a valid persisted fullscreen lyrics font size", () => {
    const storage = makeStorage({
      [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({ fullscreenLyricsFontSize: MAX_FULLSCREEN_LYRICS_FONT_SIZE })
    });

    expect(readAppSettings(storage)).toEqual({ fullscreenLyricsFontSize: MAX_FULLSCREEN_LYRICS_FONT_SIZE });
  });

  it("rounds a valid persisted decimal fullscreen lyrics font size", () => {
    const storage = makeStorage({
      [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({ fullscreenLyricsFontSize: 36.6 })
    });

    expect(readAppSettings(storage)).toEqual({ fullscreenLyricsFontSize: 37 });
  });

  it("writes normalized settings", () => {
    const storage = makeStorage();

    writeAppSettings({ fullscreenLyricsFontSize: MIN_FULLSCREEN_LYRICS_FONT_SIZE }, storage);

    expect(storage.setItem).toHaveBeenCalledWith(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({ fullscreenLyricsFontSize: MIN_FULLSCREEN_LYRICS_FONT_SIZE })
    );
  });

  it("returns fallback settings without exposing the default settings object", () => {
    const settings = readAppSettings(makeStorage());

    settings.fullscreenLyricsFontSize = 48;

    expect(DEFAULT_APP_SETTINGS).toEqual({ fullscreenLyricsFontSize: 36 });
    expect(readAppSettings(makeStorage())).toEqual({ fullscreenLyricsFontSize: 36 });
  });
});

function makeStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    })
  };
}
