export const APP_SETTINGS_STORAGE_KEY = "musicplayer:settings";
export const MIN_FULLSCREEN_LYRICS_FONT_SIZE = 24;
export const MAX_FULLSCREEN_LYRICS_FONT_SIZE = 56;
export const MIN_DESKTOP_LYRICS_FONT_SIZE = 18;
export const MAX_DESKTOP_LYRICS_FONT_SIZE = 44;
export const DEFAULT_DESKTOP_LYRICS_CURRENT_COLOR = "#FFFFFF";
export const DEFAULT_DESKTOP_LYRICS_NEXT_COLOR = "#9CA3AF";
export const DEFAULT_VOLUME = 0.82;

export type RepeatMode = "off" | "all" | "one";

export interface AppSettings {
  fullscreenLyricsFontFamily: string;
  fullscreenLyricsFontSize: number;
  systemMediaShortcutsEnabled: boolean;
  closeWindowStopsPlayback: boolean;
  desktopLyricsEnabled: boolean;
  desktopLyricsFontFamily: string;
  desktopLyricsFontSize: number;
  desktopLyricsCurrentColor: string;
  desktopLyricsNextColor: string;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  fullscreenLyricsFontFamily: "",
  fullscreenLyricsFontSize: 36,
  systemMediaShortcutsEnabled: false,
  closeWindowStopsPlayback: false,
  desktopLyricsEnabled: false,
  desktopLyricsFontFamily: "",
  desktopLyricsFontSize: 28,
  desktopLyricsCurrentColor: DEFAULT_DESKTOP_LYRICS_CURRENT_COLOR,
  desktopLyricsNextColor: DEFAULT_DESKTOP_LYRICS_NEXT_COLOR,
  volume: DEFAULT_VOLUME,
  shuffle: false,
  repeat: "off"
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

  const desktopFontSizeValue = getValueOrDefault(
    value,
    "desktopLyricsFontSize",
    DEFAULT_APP_SETTINGS.desktopLyricsFontSize
  );
  const desktopFontSize = normalizeFontSize(
    desktopFontSizeValue,
    MIN_DESKTOP_LYRICS_FONT_SIZE,
    MAX_DESKTOP_LYRICS_FONT_SIZE
  );
  if (desktopFontSize === null) {
    return defaultAppSettings();
  }

  const fullscreenFontFamily = getValueOrDefault(
    value,
    "fullscreenLyricsFontFamily",
    DEFAULT_APP_SETTINGS.fullscreenLyricsFontFamily
  );
  const desktopFontFamily = getValueOrDefault(
    value,
    "desktopLyricsFontFamily",
    DEFAULT_APP_SETTINGS.desktopLyricsFontFamily
  );
  const desktopLyricsCurrentColor = normalizeHexColor(
    getValueOrDefault(value, "desktopLyricsCurrentColor", DEFAULT_APP_SETTINGS.desktopLyricsCurrentColor)
  );
  const desktopLyricsNextColor = normalizeHexColor(
    getValueOrDefault(value, "desktopLyricsNextColor", DEFAULT_APP_SETTINGS.desktopLyricsNextColor)
  );
  const desktopLyricsEnabled = getValueOrDefault(
    value,
    "desktopLyricsEnabled",
    DEFAULT_APP_SETTINGS.desktopLyricsEnabled
  );
  const systemMediaShortcutsEnabled = getValueOrDefault(
    value,
    "systemMediaShortcutsEnabled",
    DEFAULT_APP_SETTINGS.systemMediaShortcutsEnabled
  );
  const closeWindowStopsPlayback = getValueOrDefault(
    value,
    "closeWindowStopsPlayback",
    DEFAULT_APP_SETTINGS.closeWindowStopsPlayback
  );
  const volume = normalizeVolume(getValueOrDefault(value, "volume", DEFAULT_APP_SETTINGS.volume));
  const shuffle = getValueOrDefault(value, "shuffle", DEFAULT_APP_SETTINGS.shuffle);
  const repeat = getValueOrDefault(value, "repeat", DEFAULT_APP_SETTINGS.repeat);

  if (
    typeof fullscreenFontFamily !== "string" ||
    typeof desktopFontFamily !== "string" ||
    desktopLyricsCurrentColor === null ||
    desktopLyricsNextColor === null ||
    typeof desktopLyricsEnabled !== "boolean" ||
    typeof systemMediaShortcutsEnabled !== "boolean" ||
    typeof closeWindowStopsPlayback !== "boolean" ||
    volume === null ||
    typeof shuffle !== "boolean" ||
    !isRepeatMode(repeat)
  ) {
    return defaultAppSettings();
  }

  return {
    fullscreenLyricsFontFamily: fullscreenFontFamily.trim(),
    fullscreenLyricsFontSize: fullscreenFontSize,
    systemMediaShortcutsEnabled,
    closeWindowStopsPlayback,
    desktopLyricsEnabled,
    desktopLyricsFontFamily: desktopFontFamily.trim(),
    desktopLyricsFontSize: desktopFontSize,
    desktopLyricsCurrentColor,
    desktopLyricsNextColor,
    volume,
    shuffle,
    repeat
  };
}

function normalizeFontSize(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    return null;
  }

  return Math.round(value);
}

function normalizeHexColor(value: unknown) {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    return null;
  }

  return value.toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getValueOrDefault(value: Record<string, unknown>, key: string, defaultValue: unknown) {
  return Object.prototype.hasOwnProperty.call(value, key) ? value[key] : defaultValue;
}

function normalizeVolume(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    return null;
  }

  return value;
}

function isRepeatMode(value: unknown): value is RepeatMode {
  return value === "off" || value === "all" || value === "one";
}

function defaultAppSettings(): AppSettings {
  return { ...DEFAULT_APP_SETTINGS };
}
