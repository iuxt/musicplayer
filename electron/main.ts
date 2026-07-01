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
import { assertPathInsideAnyRoot, assertPathInsideRoot, getTrustedDevServerUrl } from "../src/main/security.js";
import {
  clampDesktopLyricsPosition,
  readDesktopLyricsPosition,
  writeDesktopLyricsPosition
} from "../src/main/desktopLyricsPosition.js";
import { clearLibraryCacheFile, readLibraryCacheFile, writeLibraryCacheFile } from "../src/main/libraryCache.js";
import { writeTrackMetadata } from "../src/main/metadataWriter.js";
import {
  addTrackToM3uPlaylistFile,
  createM3uPlaylistFile,
  deleteM3uPlaylistFile,
  removeTrackFromM3uPlaylistFile,
  renameM3uPlaylistFile
} from "../src/main/playlists.js";
import { scanMusicFolder } from "../src/main/scanner.js";
import { listSystemFonts } from "../src/main/systemFonts.js";
import { trashFileWithFallback, trashTrackFiles, trashTrackLyrics } from "../src/main/trackFileActions.js";
import type { DesktopLyricsPayload, LibraryPlaylist, ScanResult, Track, TrackMetadataUpdate } from "../src/shared/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appIconPath = path.join(__dirname, "../../build/app-icon.png");
const appDisplayName = "音乐播放器";
let mainWindow: BrowserWindow | null = null;
let desktopLyricsWindow: BrowserWindow | null = null;
let latestDesktopLyricsPayload: DesktopLyricsPayload | null = null;
let currentLibraryRootPath: string | null = null;
let isQuitting = false;
let closeWindowStopsPlayback = false;
const maxDesktopLyricsWidth = 960;
const maxDesktopLyricsHeight = 240;
const defaultDesktopLyricsWidth = 420;
const defaultDesktopLyricsHeight = 92;
let desktopLyricsPositionPersistTimer: ReturnType<typeof setTimeout> | null = null;

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

function trashFile(filePath: string) {
  return trashFileWithFallback(filePath, (targetPath) => shell.trashItem(targetPath));
}

async function toPlaylistMutationResult(action: () => Promise<LibraryPlaylist>) {
  try {
    return { ok: true as const, playlist: await action() };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "无法更新播放列表。" };
  }
}

async function toMediaActionResult(action: () => Promise<void>) {
  try {
    await action();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "无法更新播放列表。" };
  }
}

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
  const devServerUrl = getTrustedDevServerUrl(process.env.VITE_DEV_SERVER_URL, !app.isPackaged);
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

function setCurrentLibraryRootPath(folderPath: string) {
  currentLibraryRootPath = path.resolve(folderPath);
  return currentLibraryRootPath;
}

function setInitialOrAssertCurrentLibraryRootPath(folderPath: string) {
  const resolvedFolderPath = path.resolve(folderPath);
  if (!currentLibraryRootPath) {
    currentLibraryRootPath = resolvedFolderPath;
    return resolvedFolderPath;
  }
  return assertCurrentLibraryRoot(folderPath);
}

function assertCurrentLibraryPath(filePath: string | null | undefined) {
  return assertPathInsideRoot(filePath, currentLibraryRootPath);
}

function assertCurrentLibraryArtworkPath(filePath: string | null | undefined) {
  return assertPathInsideAnyRoot(
    filePath,
    [currentLibraryRootPath, getArtworkCacheDir()].filter((value): value is string => Boolean(value))
  );
}

function assertCurrentLibraryRoot(folderPath: string) {
  const resolvedFolderPath = path.resolve(folderPath);
  if (currentLibraryRootPath && resolvedFolderPath !== currentLibraryRootPath) {
    throw new Error("文件夹不是当前音乐库。");
  }
  return resolvedFolderPath;
}

function assertCurrentLibraryTrack(track: Track) {
  return {
    ...track,
    filePath: assertCurrentLibraryPath(track.filePath),
    artworkPath: track.artworkPath ? assertCurrentLibraryArtworkPath(track.artworkPath) : track.artworkPath,
    lyricsPath: track.lyricsPath ? assertCurrentLibraryPath(track.lyricsPath) : track.lyricsPath
  };
}

async function showDesktopLyricsWindow() {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.showInactive();
    if (latestDesktopLyricsPayload) {
      desktopLyricsWindow.webContents.send("desktop-lyrics:update", latestDesktopLyricsPayload);
    }
    return;
  }

  const initialPosition = await getInitialDesktopLyricsPosition();

  desktopLyricsWindow = new BrowserWindow({
    title: "桌面歌词",
    width: defaultDesktopLyricsWidth,
    height: defaultDesktopLyricsHeight,
    ...(initialPosition ? { x: initialPosition.x, y: initialPosition.y } : {}),
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

  desktopLyricsWindow.on("move", () => {
    scheduleDesktopLyricsPositionPersist();
  });

  desktopLyricsWindow.on("close", () => {
    persistDesktopLyricsPosition();
  });

  desktopLyricsWindow.on("closed", () => {
    desktopLyricsWindow = null;
    if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
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
  scheduleDesktopLyricsPositionPersist();
}

async function getInitialDesktopLyricsPosition() {
  const savedPosition = await readDesktopLyricsPosition(getDesktopLyricsPositionPath());
  if (!savedPosition) {
    return null;
  }

  const defaultSize = { width: defaultDesktopLyricsWidth, height: defaultDesktopLyricsHeight };
  const workArea = screen.getDisplayMatching({ ...savedPosition, ...defaultSize }).workArea;
  return clampDesktopLyricsPosition(savedPosition, defaultSize, workArea);
}

function scheduleDesktopLyricsPositionPersist() {
  if (desktopLyricsPositionPersistTimer) {
    clearTimeout(desktopLyricsPositionPersistTimer);
  }

  desktopLyricsPositionPersistTimer = setTimeout(() => {
    desktopLyricsPositionPersistTimer = null;
    persistDesktopLyricsPosition();
  }, 150);
}

function persistDesktopLyricsPosition() {
  if (desktopLyricsPositionPersistTimer) {
    clearTimeout(desktopLyricsPositionPersistTimer);
    desktopLyricsPositionPersistTimer = null;
  }

  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) {
    return;
  }

  const { x, y } = desktopLyricsWindow.getBounds();
  void writeDesktopLyricsPosition(getDesktopLyricsPositionPath(), { x, y }).catch(() => undefined);
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

    const folderPath = setCurrentLibraryRootPath(result.filePaths[0]);
    return scanMusicFolder(folderPath, {
      artworkCacheDir: getArtworkCacheDir(),
      onProgress: (progress) => event.sender.send("library:scan-progress", progress)
    });
  });

  ipcMain.handle("library:rescan", async (event, folderPath: string) => {
    const libraryRootPath = setInitialOrAssertCurrentLibraryRootPath(folderPath);
    return scanMusicFolder(libraryRootPath, {
      artworkCacheDir: getArtworkCacheDir(),
      onProgress: (progress) => event.sender.send("library:scan-progress", progress)
    });
  });

  ipcMain.handle("library:read-cache", () => {
    return readLibraryCacheFile(getLibraryCachePath());
  });

  ipcMain.handle("library:write-cache", (_event, result: ScanResult) => {
    return writeLibraryCacheFile(getLibraryCachePath(), result);
  });

  ipcMain.handle("library:clear-cache", () => {
    return clearLibraryCacheFile(getLibraryCachePath());
  });

  ipcMain.handle("library:create-playlist", (_event, folderPath: string, name: string) => {
    return toPlaylistMutationResult(() => createM3uPlaylistFile(assertCurrentLibraryRoot(folderPath), name));
  });

  ipcMain.handle("library:rename-playlist", (_event, folderPath: string, playlist: LibraryPlaylist, name: string) => {
    return toPlaylistMutationResult(() => renameM3uPlaylistFile(assertCurrentLibraryRoot(folderPath), playlist, name));
  });

  ipcMain.handle("library:delete-playlist", (_event, folderPath: string, playlist: LibraryPlaylist) => {
    return toMediaActionResult(() => deleteM3uPlaylistFile(assertCurrentLibraryRoot(folderPath), playlist, trashFile));
  });

  ipcMain.handle("library:remove-track-from-playlist", (_event, folderPath: string, playlist: LibraryPlaylist, track: Track) => {
    return toPlaylistMutationResult(() =>
      removeTrackFromM3uPlaylistFile(assertCurrentLibraryRoot(folderPath), playlist, assertCurrentLibraryTrack(track))
    );
  });

  ipcMain.handle("library:add-track-to-playlist", (_event, folderPath: string, playlist: LibraryPlaylist, track: Track) => {
    return toPlaylistMutationResult(() =>
      addTrackToM3uPlaylistFile(assertCurrentLibraryRoot(folderPath), playlist, assertCurrentLibraryTrack(track))
    );
  });

  ipcMain.handle("media:get-playable-url", (_event, filePath: string) => {
    return toMediaFileUrl(assertCurrentLibraryPath(filePath));
  });

  ipcMain.handle("media:get-artwork-url", (_event, filePath: string | null) => {
    return toExistingOptionalFileUrl(filePath ? assertCurrentLibraryArtworkPath(filePath) : null);
  });

  ipcMain.handle("media:get-lyrics", (_event, filePath: string | null) => {
    return readLyricsFile(filePath ? assertCurrentLibraryPath(filePath) : null);
  });

  ipcMain.handle("media:show-track-in-folder", (_event, filePath: string) => {
    shell.showItemInFolder(assertCurrentLibraryPath(filePath));
    return { ok: true };
  });

  ipcMain.handle("media:update-track-metadata", (_event, filePath: string, metadata: TrackMetadataUpdate) => {
    return writeTrackMetadata(assertCurrentLibraryPath(filePath), metadata);
  });

  ipcMain.handle("media:trash-track-lyrics", (_event, track: Track) => {
    return trashTrackLyrics(assertCurrentLibraryTrack(track), trashFile);
  });

  ipcMain.handle("media:trash-track-files", (_event, track: Track) => {
    return trashTrackFiles(assertCurrentLibraryTrack(track), trashFile);
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

function getLibraryCachePath() {
  return path.join(app.getPath("userData"), "library-cache.json");
}

function getDesktopLyricsPositionPath() {
  return path.join(app.getPath("userData"), "desktop-lyrics-position.json");
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
