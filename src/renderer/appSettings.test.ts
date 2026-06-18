import { describe, expect, it, vi } from "vitest";
import {
  APP_SETTINGS_STORAGE_KEY,
  DEFAULT_APP_SETTINGS,
  MAX_DESKTOP_LYRICS_FONT_SIZE,
  MAX_FULLSCREEN_LYRICS_FONT_SIZE,
  MIN_DESKTOP_LYRICS_FONT_SIZE,
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
    expect(
      readAppSettings(
        makeStorage({
          [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
            fullscreenLyricsFontSize: 36,
            desktopLyricsFontSize: 12
          })
        })
      )
    ).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("migrates a valid legacy fullscreen lyrics font size", () => {
    const storage = makeStorage({
      [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({ fullscreenLyricsFontSize: MAX_FULLSCREEN_LYRICS_FONT_SIZE })
    });

    expect(readAppSettings(storage)).toEqual({
      ...DEFAULT_APP_SETTINGS,
      fullscreenLyricsFontSize: MAX_FULLSCREEN_LYRICS_FONT_SIZE
    });
  });

  it("reads valid persisted lyric font settings", () => {
    const storage = makeStorage({
      [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
        fullscreenLyricsFontFamily: "PingFang SC",
        fullscreenLyricsFontSize: MAX_FULLSCREEN_LYRICS_FONT_SIZE,
        desktopLyricsEnabled: true,
        desktopLyricsFontFamily: "LXGW WenKai",
        desktopLyricsFontSize: MAX_DESKTOP_LYRICS_FONT_SIZE
      })
    });

    expect(readAppSettings(storage)).toEqual({
      fullscreenLyricsFontFamily: "PingFang SC",
      fullscreenLyricsFontSize: MAX_FULLSCREEN_LYRICS_FONT_SIZE,
      desktopLyricsEnabled: true,
      desktopLyricsFontFamily: "LXGW WenKai",
      desktopLyricsFontSize: MAX_DESKTOP_LYRICS_FONT_SIZE
    });
  });

  it("rounds valid persisted decimal lyric font sizes", () => {
    const storage = makeStorage({
      [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
        fullscreenLyricsFontFamily: "",
        fullscreenLyricsFontSize: 36.6,
        desktopLyricsEnabled: false,
        desktopLyricsFontFamily: "",
        desktopLyricsFontSize: 28.4
      })
    });

    expect(readAppSettings(storage)).toEqual({
      ...DEFAULT_APP_SETTINGS,
      fullscreenLyricsFontSize: 37,
      desktopLyricsFontSize: 28
    });
  });

  it("writes normalized settings", () => {
    const storage = makeStorage();

    writeAppSettings(
      {
        fullscreenLyricsFontFamily: "PingFang SC",
        fullscreenLyricsFontSize: MIN_FULLSCREEN_LYRICS_FONT_SIZE,
        desktopLyricsEnabled: true,
        desktopLyricsFontFamily: "LXGW WenKai",
        desktopLyricsFontSize: MIN_DESKTOP_LYRICS_FONT_SIZE
      },
      storage
    );

    expect(storage.setItem).toHaveBeenCalledWith(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        fullscreenLyricsFontFamily: "PingFang SC",
        fullscreenLyricsFontSize: MIN_FULLSCREEN_LYRICS_FONT_SIZE,
        desktopLyricsEnabled: true,
        desktopLyricsFontFamily: "LXGW WenKai",
        desktopLyricsFontSize: MIN_DESKTOP_LYRICS_FONT_SIZE
      })
    );
  });

  it("returns fallback settings without exposing the default settings object", () => {
    const settings = readAppSettings(makeStorage());

    settings.fullscreenLyricsFontSize = 48;
    settings.desktopLyricsEnabled = true;

    expect(DEFAULT_APP_SETTINGS).toEqual({
      fullscreenLyricsFontFamily: "",
      fullscreenLyricsFontSize: 36,
      desktopLyricsEnabled: false,
      desktopLyricsFontFamily: "",
      desktopLyricsFontSize: 28
    });
    expect(readAppSettings(makeStorage())).toEqual(DEFAULT_APP_SETTINGS);
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
