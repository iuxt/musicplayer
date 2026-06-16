export const APP_SETTINGS_STORAGE_KEY = "local-music-player:settings";
export const MIN_FULLSCREEN_LYRICS_FONT_SIZE = 24;
export const MAX_FULLSCREEN_LYRICS_FONT_SIZE = 56;

export interface AppSettings {
  fullscreenLyricsFontSize: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  fullscreenLyricsFontSize: 36
};

type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

export function readAppSettings(storage: SettingsStorage = localStorage): AppSettings {
  const savedValue = storage.getItem(APP_SETTINGS_STORAGE_KEY);
  if (!savedValue) {
    return DEFAULT_APP_SETTINGS;
  }

  try {
    return normalizeAppSettings(JSON.parse(savedValue) as unknown);
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function writeAppSettings(settings: AppSettings, storage: SettingsStorage = localStorage) {
  storage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeAppSettings(settings)));
}

export function normalizeAppSettings(value: unknown): AppSettings {
  if (!isRecord(value)) {
    return DEFAULT_APP_SETTINGS;
  }

  const fontSize = value.fullscreenLyricsFontSize;
  if (
    typeof fontSize !== "number" ||
    !Number.isFinite(fontSize) ||
    fontSize < MIN_FULLSCREEN_LYRICS_FONT_SIZE ||
    fontSize > MAX_FULLSCREEN_LYRICS_FONT_SIZE
  ) {
    return DEFAULT_APP_SETTINGS;
  }

  return {
    fullscreenLyricsFontSize: Math.round(fontSize)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
