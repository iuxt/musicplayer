import { describe, expect, it, vi } from "vitest";
import {
  APP_SETTINGS_STORAGE_KEY,
  DEFAULT_APP_SETTINGS,
  DEFAULT_DESKTOP_LYRICS_CURRENT_COLOR,
  DEFAULT_DESKTOP_LYRICS_NEXT_COLOR,
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

  it("returns defaults for explicitly invalid persisted lyric fields", () => {
    expect(
      readAppSettings(
        makeStorage({
          [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
            fullscreenLyricsFontSize: 40,
            desktopLyricsFontSize: null
          })
        })
      )
    ).toEqual(DEFAULT_APP_SETTINGS);
    expect(
      readAppSettings(
        makeStorage({
          [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
            fullscreenLyricsFontSize: 40,
            desktopLyricsEnabled: null
          })
        })
      )
    ).toEqual(DEFAULT_APP_SETTINGS);
    expect(
      readAppSettings(
        makeStorage({
          [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
            fullscreenLyricsFontSize: 40,
            desktopLyricsFontFamily: null
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
        closeWindowStopsPlayback: true,
        desktopLyricsEnabled: true,
        desktopLyricsFontFamily: "LXGW WenKai",
        desktopLyricsFontSize: MAX_DESKTOP_LYRICS_FONT_SIZE
      })
    });

    expect(readAppSettings(storage)).toEqual({
      fullscreenLyricsFontFamily: "PingFang SC",
      fullscreenLyricsFontSize: MAX_FULLSCREEN_LYRICS_FONT_SIZE,
      systemMediaShortcutsEnabled: false,
      closeWindowStopsPlayback: true,
      desktopLyricsEnabled: true,
      desktopLyricsFontFamily: "LXGW WenKai",
      desktopLyricsFontSize: MAX_DESKTOP_LYRICS_FONT_SIZE,
      desktopLyricsCurrentColor: "#FFFFFF",
      desktopLyricsNextColor: "#9CA3AF",
      volume: 0.82,
      shuffle: false,
      repeat: "off"
    });
  });

  it("reads and writes playback preferences", () => {
    const storage = makeStorage({
      [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
        ...DEFAULT_APP_SETTINGS,
        volume: 0.42,
        shuffle: true,
        repeat: "all"
      })
    });

    expect(readAppSettings(storage)).toEqual({
      ...DEFAULT_APP_SETTINGS,
      volume: 0.42,
      shuffle: true,
      repeat: "all"
    });

    writeAppSettings(
      {
        ...DEFAULT_APP_SETTINGS,
        volume: 0.64,
        shuffle: false,
        repeat: "one"
      },
      storage
    );

    expect(storage.setItem).toHaveBeenCalledWith(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_APP_SETTINGS,
        volume: 0.64,
        shuffle: false,
        repeat: "one"
      })
    );
  });

  it("fills missing playback preferences with defaults for legacy settings", () => {
    const storage = makeStorage({
      [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
        fullscreenLyricsFontFamily: "",
        fullscreenLyricsFontSize: 36,
        systemMediaShortcutsEnabled: false,
        closeWindowStopsPlayback: false,
        desktopLyricsEnabled: false,
        desktopLyricsFontFamily: "",
        desktopLyricsFontSize: 28
      })
    });

    expect(readAppSettings(storage)).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("fills missing desktop lyric colors with defaults for legacy settings", () => {
    const storage = makeStorage({
      [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
        fullscreenLyricsFontFamily: "",
        fullscreenLyricsFontSize: 36,
        systemMediaShortcutsEnabled: false,
        closeWindowStopsPlayback: false,
        desktopLyricsEnabled: false,
        desktopLyricsFontFamily: "",
        desktopLyricsFontSize: 28,
        volume: 0.82,
        shuffle: false,
        repeat: "off"
      })
    });

    expect(readAppSettings(storage)).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("reads and writes desktop lyric colors", () => {
    const storage = makeStorage({
      [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
        ...DEFAULT_APP_SETTINGS,
        desktopLyricsCurrentColor: "#ffcc00",
        desktopLyricsNextColor: "#5eead4"
      })
    });

    expect(readAppSettings(storage)).toEqual({
      ...DEFAULT_APP_SETTINGS,
      desktopLyricsCurrentColor: "#FFCC00",
      desktopLyricsNextColor: "#5EEAD4"
    });

    writeAppSettings(
      {
        ...DEFAULT_APP_SETTINGS,
        desktopLyricsCurrentColor: "#f472b6",
        desktopLyricsNextColor: "#38bdf8"
      },
      storage
    );

    expect(storage.setItem).toHaveBeenCalledWith(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_APP_SETTINGS,
        desktopLyricsCurrentColor: "#F472B6",
        desktopLyricsNextColor: "#38BDF8"
      })
    );
  });

  it("returns defaults for invalid persisted desktop lyric colors", () => {
    expect(
      readAppSettings(
        makeStorage({
          [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
            ...DEFAULT_APP_SETTINGS,
            desktopLyricsCurrentColor: "white"
          })
        })
      )
    ).toEqual(DEFAULT_APP_SETTINGS);

    expect(
      readAppSettings(
        makeStorage({
          [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
            ...DEFAULT_APP_SETTINGS,
            desktopLyricsNextColor: "#FFF"
          })
        })
      )
    ).toEqual(DEFAULT_APP_SETTINGS);

    expect(
      readAppSettings(
        makeStorage({
          [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
            ...DEFAULT_APP_SETTINGS,
            desktopLyricsNextColor: null
          })
        })
      )
    ).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("returns defaults for invalid persisted playback preferences", () => {
    expect(
      readAppSettings(
        makeStorage({
          [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
            ...DEFAULT_APP_SETTINGS,
            volume: 2
          })
        })
      )
    ).toEqual(DEFAULT_APP_SETTINGS);
    expect(
      readAppSettings(
        makeStorage({
          [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
            ...DEFAULT_APP_SETTINGS,
            shuffle: "yes"
          })
        })
      )
    ).toEqual(DEFAULT_APP_SETTINGS);
    expect(
      readAppSettings(
        makeStorage({
          [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
            ...DEFAULT_APP_SETTINGS,
            repeat: "repeat"
          })
        })
      )
    ).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("reads and writes the system media shortcut setting", () => {
    const storage = makeStorage({
      [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
        fullscreenLyricsFontFamily: "",
        fullscreenLyricsFontSize: 36,
        desktopLyricsEnabled: false,
        desktopLyricsFontFamily: "",
        desktopLyricsFontSize: 28,
        systemMediaShortcutsEnabled: true
      })
    });

    expect(readAppSettings(storage)).toEqual({
      ...DEFAULT_APP_SETTINGS,
      systemMediaShortcutsEnabled: true
    });

    writeAppSettings(
      {
        ...DEFAULT_APP_SETTINGS,
        systemMediaShortcutsEnabled: true
      },
      storage
    );

    expect(storage.setItem).toHaveBeenCalledWith(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_APP_SETTINGS,
        systemMediaShortcutsEnabled: true
      })
    );
  });

  it("reads and writes the close-window playback setting", () => {
    const storage = makeStorage({
      [APP_SETTINGS_STORAGE_KEY]: JSON.stringify({
        fullscreenLyricsFontFamily: "",
        fullscreenLyricsFontSize: 36,
        systemMediaShortcutsEnabled: false,
        closeWindowStopsPlayback: true,
        desktopLyricsEnabled: false,
        desktopLyricsFontFamily: "",
        desktopLyricsFontSize: 28
      })
    });

    expect(readAppSettings(storage)).toEqual({
      ...DEFAULT_APP_SETTINGS,
      closeWindowStopsPlayback: true
    });

    writeAppSettings(
      {
        ...DEFAULT_APP_SETTINGS,
        closeWindowStopsPlayback: true
      },
      storage
    );

    expect(storage.setItem).toHaveBeenCalledWith(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_APP_SETTINGS,
        closeWindowStopsPlayback: true
      })
    );
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
        fullscreenLyricsFontFamily: "  PingFang SC  ",
        fullscreenLyricsFontSize: MIN_FULLSCREEN_LYRICS_FONT_SIZE + 0.6,
        systemMediaShortcutsEnabled: false,
        closeWindowStopsPlayback: false,
        desktopLyricsEnabled: true,
        desktopLyricsFontFamily: "  LXGW WenKai  ",
        desktopLyricsFontSize: MIN_DESKTOP_LYRICS_FONT_SIZE + 0.4,
        desktopLyricsCurrentColor: "#ffffff",
        desktopLyricsNextColor: "#9ca3af",
        volume: 0.82,
        shuffle: false,
        repeat: "off"
      },
      storage
    );

    expect(storage.setItem).toHaveBeenCalledWith(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        fullscreenLyricsFontFamily: "PingFang SC",
        fullscreenLyricsFontSize: MIN_FULLSCREEN_LYRICS_FONT_SIZE + 1,
        systemMediaShortcutsEnabled: false,
        closeWindowStopsPlayback: false,
        desktopLyricsEnabled: true,
        desktopLyricsFontFamily: "LXGW WenKai",
        desktopLyricsFontSize: MIN_DESKTOP_LYRICS_FONT_SIZE,
        desktopLyricsCurrentColor: DEFAULT_DESKTOP_LYRICS_CURRENT_COLOR,
        desktopLyricsNextColor: DEFAULT_DESKTOP_LYRICS_NEXT_COLOR,
        volume: 0.82,
        shuffle: false,
        repeat: "off"
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
      systemMediaShortcutsEnabled: false,
      closeWindowStopsPlayback: false,
      desktopLyricsEnabled: false,
      desktopLyricsFontFamily: "",
      desktopLyricsFontSize: 28,
      desktopLyricsCurrentColor: "#FFFFFF",
      desktopLyricsNextColor: "#9CA3AF",
      volume: 0.82,
      shuffle: false,
      repeat: "off"
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
