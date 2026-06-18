export const APP_SETTINGS_STORAGE_KEY = "musicplayer:settings";
export const MIN_FULLSCREEN_LYRICS_FONT_SIZE = 24;
export const MAX_FULLSCREEN_LYRICS_FONT_SIZE = 56;
export const MIN_DESKTOP_LYRICS_FONT_SIZE = 18;
export const MAX_DESKTOP_LYRICS_FONT_SIZE = 44;

export interface AppSettings {
  fullscreenLyricsFontFamily: string;
  fullscreenLyricsFontSize: number;
  desktopLyricsEnabled: boolean;
  desktopLyricsFontFamily: string;
  desktopLyricsFontSize: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  fullscreenLyricsFontFamily: "",
  fullscreenLyricsFontSize: 36,
  desktopLyricsEnabled: false,
  desktopLyricsFontFamily: "",
  desktopLyricsFontSize: 28
};

type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

export function readAppSettings(storage: SettingsStorage = localStorage): AppSettings {
  try {
    const savedValue = storage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!savedValue) {
      return defaultAppSettings();
    }

    return normalizeAppSettings(JSON.parse(savedValue) as unknown);
  } catch {
    return defaultAppSettings();
  }
}

export function writeAppSettings(settings: AppSettings, storage: SettingsStorage = localStorage) {
  storage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeAppSettings(settings)));
}

export function normalizeAppSettings(value: unknown): AppSettings {
  if (!isRecord(value)) {
    return defaultAppSettings();
  }

  const fullscreenFontSize = normalizeFontSize(
    value.fullscreenLyricsFontSize,
    MIN_FULLSCREEN_LYRICS_FONT_SIZE,
    MAX_FULLSCREEN_LYRICS_FONT_SIZE
  );
  if (fullscreenFontSize === null) {
    return defaultAppSettings();
  }

  const desktopFontSizeValue = value.desktopLyricsFontSize ?? DEFAULT_APP_SETTINGS.desktopLyricsFontSize;
  const desktopFontSize = normalizeFontSize(
    desktopFontSizeValue,
    MIN_DESKTOP_LYRICS_FONT_SIZE,
    MAX_DESKTOP_LYRICS_FONT_SIZE
  );
  if (desktopFontSize === null) {
    return defaultAppSettings();
  }

  const fullscreenFontFamily = value.fullscreenLyricsFontFamily ?? DEFAULT_APP_SETTINGS.fullscreenLyricsFontFamily;
  const desktopFontFamily = value.desktopLyricsFontFamily ?? DEFAULT_APP_SETTINGS.desktopLyricsFontFamily;
  const desktopLyricsEnabled = value.desktopLyricsEnabled ?? DEFAULT_APP_SETTINGS.desktopLyricsEnabled;

  if (
    typeof fullscreenFontFamily !== "string" ||
    typeof desktopFontFamily !== "string" ||
    typeof desktopLyricsEnabled !== "boolean"
  ) {
    return defaultAppSettings();
  }

  return {
    fullscreenLyricsFontFamily: fullscreenFontFamily.trim(),
    fullscreenLyricsFontSize: fullscreenFontSize,
    desktopLyricsEnabled,
    desktopLyricsFontFamily: desktopFontFamily.trim(),
    desktopLyricsFontSize: desktopFontSize
  };
}

function normalizeFontSize(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    return null;
  }

  return Math.round(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function defaultAppSettings(): AppSettings {
  return { ...DEFAULT_APP_SETTINGS };
}
