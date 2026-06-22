import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  screen,
  shell,
  systemPreferences,
  type MenuItemConstructorOptions,
  type OpenDialogOptions
} from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readLyricsFile, toExistingOptionalFileUrl, toMediaFileUrl } from "../src/main/fileUrls.js";
import { writeTrackMetadata } from "../src/main/metadataWriter.js";
import { scanMusicFolder } from "../src/main/scanner.js";
import { listSystemFonts } from "../src/main/systemFonts.js";
import { trashTrackFiles, trashTrackLyrics } from "../src/main/trackFileActions.js";
import type { DesktopLyricsPayload, Track, TrackMetadataUpdate } from "../src/shared/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appIconPath = path.join(__dirname, "../../build/app-icon.png");
const appDisplayName = "音乐播放器";
let mainWindow: BrowserWindow | null = null;
let desktopLyricsWindow: BrowserWindow | null = null;
let latestDesktopLyricsPayload: DesktopLyricsPayload | null = null;
let isQuitting = false;
let closeWindowStopsPlayback = false;
const maxDesktopLyricsWidth = 960;
const maxDesktopLyricsHeight = 240;

app.setName(appDisplayName);

type MenuCommand = "choose-folder" | "rescan-library" | "open-settings";
type MediaKeyCommand = "play-pause" | "next" | "previous";
type SystemMediaShortcutsResult = { ok: true } | { ok: false; failedCommands: MediaKeyCommand[] };
type SystemMediaShortcutsPermissionResult =
  | { ok: true }
  | { ok: false; reason: "accessibility-permission-denied" };

const systemMediaShortcuts: Array<{ accelerator: string; command: MediaKeyCommand }> = [
  { accelerator: "MediaPlayPause", command: "play-pause" },
  { accelerator: "MediaNextTrack", command: "next" },
  { accelerator: "MediaPreviousTrack", command: "previous" }
];

function sendMenuCommand(command: MenuCommand) {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  targetWindow?.webContents.send("library:menu-command", command);
}

function sendMediaKeyCommand(command: MediaKeyCommand) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("playback:media-key-command", command);
}

function unregisterSystemMediaShortcuts() {
  for (const shortcut of systemMediaShortcuts) {
    globalShortcut.unregister(shortcut.accelerator);
  }
}

function setSystemMediaShortcutsEnabled(enabled: boolean): SystemMediaShortcutsResult {
  unregisterSystemMediaShortcuts();
  if (!enabled) {
    return { ok: true };
  }

  const failedCommands = systemMediaShortcuts
    .filter((shortcut) => !globalShortcut.register(shortcut.accelerator, () => sendMediaKeyCommand(shortcut.command)))
    .map((shortcut) => shortcut.command);

  if (failedCommands.length > 0) {
    unregisterSystemMediaShortcuts();
    return { ok: false, failedCommands };
  }

  return { ok: true };
}

async function ensureSystemMediaShortcutsPermission(): Promise<SystemMediaShortcutsPermissionResult> {
  if (process.platform !== "darwin" || systemPreferences.isTrustedAccessibilityClient(false)) {
    return { ok: true };
  }

  const options = {
    type: "warning" as const,
    buttons: ["知道了"],
    defaultId: 0,
    title: "需要辅助功能权限",
    message: "系统媒体快捷键需要辅助功能权限。",
    detail: "请在系统设置 > 隐私与安全 > 无障碍中允许 Electron 或音乐播放器，然后重新开启此开关。"
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    await dialog.showMessageBox(mainWindow, options);
  } else {
    await dialog.showMessageBox(options);
  }

  return { ok: false, reason: "accessibility-permission-denied" };
}

function getRendererUrl(windowMode?: "desktop-lyrics") {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (!devServerUrl) {
    return null;
  }

  if (windowMode === "desktop-lyrics") {
    return `${devServerUrl}?window=desktop-lyrics`;
  }

  return devServerUrl;
}

async function loadRendererWindow(win: BrowserWindow, windowMode?: "desktop-lyrics") {
  const rendererUrl = getRendererUrl(windowMode);
  if (rendererUrl) {
    await win.loadURL(rendererUrl);
    return;
  }

  const filePath = path.join(__dirname, "../../dist/index.html");
  const query = windowMode === "desktop-lyrics" ? { window: "desktop-lyrics" } : undefined;
  await win.loadFile(filePath, query ? { query } : undefined);
}

async function showDesktopLyricsWindow() {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.showInactive();
    if (latestDesktopLyricsPayload) {
      desktopLyricsWindow.webContents.send("desktop-lyrics:update", latestDesktopLyricsPayload);
    }
    return;
  }

  desktopLyricsWindow = new BrowserWindow({
    title: "桌面歌词",
    width: 420,
    height: 92,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    backgroundColor: "#00000000",
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  desktopLyricsWindow.excludedFromShownWindowsMenu = true;

  desktopLyricsWindow.on("closed", () => {
    desktopLyricsWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("desktop-lyrics:closed");
    }
  });

  await loadRendererWindow(desktopLyricsWindow, "desktop-lyrics");
  desktopLyricsWindow.showInactive();
  if (latestDesktopLyricsPayload) {
    desktopLyricsWindow.webContents.send("desktop-lyrics:update", latestDesktopLyricsPayload);
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resizeDesktopLyricsWindow(width: number, height: number) {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) {
    return;
  }

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return;
  }

  const currentBounds = desktopLyricsWindow.getBounds();
  const workArea = screen.getDisplayMatching(currentBounds).workArea;
  const targetWidth = clamp(Math.ceil(width), 1, Math.min(maxDesktopLyricsWidth, workArea.width));
  const targetHeight = clamp(Math.ceil(height), 1, Math.min(maxDesktopLyricsHeight, workArea.height));
  const targetX = clamp(currentBounds.x, workArea.x, workArea.x + workArea.width - targetWidth);
  const targetY = clamp(currentBounds.y, workArea.y, workArea.y + workArea.height - targetHeight);

  desktopLyricsWindow.setBounds({
    x: targetX,
    y: targetY,
    width: targetWidth,
    height: targetHeight
  });
}

function closeDesktopLyricsWindow() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow = null;
    return;
  }

  desktopLyricsWindow.close();
}

function updateDesktopLyricsWindow(payload: DesktopLyricsPayload) {
  latestDesktopLyricsPayload = payload;
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) {
    return;
  }

  desktopLyricsWindow.webContents.send("desktop-lyrics:update", payload);
}

function createApplicationMenu() {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [
          {
            label: appDisplayName,
            submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }]
          } satisfies MenuItemConstructorOptions
        ]
      : []),
    {
      label: "音乐库",
      submenu: [
        {
          label: "选择文件夹",
          accelerator: "CmdOrCtrl+O",
          click: () => sendMenuCommand("choose-folder")
        },
        {
          label: "重新扫描音乐库",
          accelerator: "CmdOrCtrl+R",
          click: () => sendMenuCommand("rescan-library")
        }
      ]
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpc() {
  ipcMain.handle("library:choose-folder", async (event) => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    const options: OpenDialogOptions = {
      title: "选择音乐文件夹",
      properties: ["openDirectory"]
    };
    const result = parentWindow
      ? await dialog.showOpenDialog(parentWindow, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const folderPath = result.filePaths[0];
    return scanMusicFolder(folderPath, {
      artworkCacheDir: getArtworkCacheDir(),
      onProgress: (progress) => event.sender.send("library:scan-progress", progress)
    });
  });

  ipcMain.handle("library:rescan", async (event, folderPath: string) => {
    return scanMusicFolder(folderPath, {
      artworkCacheDir: getArtworkCacheDir(),
      onProgress: (progress) => event.sender.send("library:scan-progress", progress)
    });
  });

  ipcMain.handle("media:get-playable-url", (_event, filePath: string) => {
    return toMediaFileUrl(filePath);
  });

  ipcMain.handle("media:get-artwork-url", (_event, filePath: string | null) => {
    return toExistingOptionalFileUrl(filePath);
  });

  ipcMain.handle("media:get-lyrics", (_event, filePath: string | null) => {
    return readLyricsFile(filePath);
  });

  ipcMain.handle("media:show-track-in-folder", (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
    return { ok: true };
  });

  ipcMain.handle("media:update-track-metadata", (_event, filePath: string, metadata: TrackMetadataUpdate) => {
    return writeTrackMetadata(filePath, metadata);
  });

  ipcMain.handle("media:trash-track-lyrics", (_event, track: Track) => {
    return trashTrackLyrics(track, (filePath) => shell.trashItem(filePath));
  });

  ipcMain.handle("media:trash-track-files", (_event, track: Track) => {
    return trashTrackFiles(track, (filePath) => shell.trashItem(filePath));
  });

  ipcMain.handle("fonts:list-system", () => {
    return listSystemFonts();
  });

  ipcMain.handle("desktop-lyrics:show", async () => {
    await showDesktopLyricsWindow();
  });

  ipcMain.handle("desktop-lyrics:close", () => {
    closeDesktopLyricsWindow();
  });

  ipcMain.handle("desktop-lyrics:update", (_event, payload: DesktopLyricsPayload) => {
    updateDesktopLyricsWindow(payload);
  });

  ipcMain.handle("desktop-lyrics:resize", (_event, width: number, height: number) => {
    resizeDesktopLyricsWindow(width, height);
  });

  ipcMain.handle("desktop-lyrics:open-settings", () => {
    mainWindow?.show();
    mainWindow?.focus();
    mainWindow?.webContents.send("library:menu-command", "open-settings");
  });

  ipcMain.handle("playback:set-system-media-shortcuts-enabled", (_event, enabled: boolean) => {
    return setSystemMediaShortcutsEnabled(Boolean(enabled));
  });

  ipcMain.handle("window:set-close-window-stops-playback", (_event, enabled: boolean) => {
    closeWindowStopsPlayback = Boolean(enabled);
  });

  ipcMain.handle("playback:ensure-system-media-shortcuts-permission", () => {
    return ensureSystemMediaShortcutsPermission();
  });
}

function getArtworkCacheDir() {
  return path.join(app.getPath("userData"), "artwork");
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#f5f5f7",
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow = win;
  win.on("close", (event) => {
    if (process.platform !== "darwin" || isQuitting || closeWindowStopsPlayback) {
      return;
    }

    event.preventDefault();
    win.hide();
  });

  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
    setTimeout(() => closeDesktopLyricsWindow(), 0);
  });

  await loadRendererWindow(win);
  if (process.env.VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools({ mode: "detach" });
  }
}

async function activateMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    await createWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    app.dock?.setIcon(appIconPath);
  }

  createApplicationMenu();
  registerIpc();
  return createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" || closeWindowStopsPlayback) {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  unregisterSystemMediaShortcuts();
});

app.on("activate", () => {
  void activateMainWindow();
});
