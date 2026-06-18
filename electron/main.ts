import { app, BrowserWindow, dialog, ipcMain, Menu, shell, type MenuItemConstructorOptions, type OpenDialogOptions } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readLyricsFile, toMediaFileUrl, toOptionalFileUrl } from "../src/main/fileUrls.js";
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

app.setName(appDisplayName);

type MenuCommand = "choose-folder" | "rescan-library" | "open-settings";

function sendMenuCommand(command: MenuCommand) {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  targetWindow?.webContents.send("library:menu-command", command);
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
    desktopLyricsWindow.show();
    desktopLyricsWindow.focus();
    if (latestDesktopLyricsPayload) {
      desktopLyricsWindow.webContents.send("desktop-lyrics:update", latestDesktopLyricsPayload);
    }
    return;
  }

  desktopLyricsWindow = new BrowserWindow({
    width: 720,
    height: 130,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  desktopLyricsWindow.on("closed", () => {
    desktopLyricsWindow = null;
    mainWindow?.webContents.send("desktop-lyrics:closed");
  });

  await loadRendererWindow(desktopLyricsWindow, "desktop-lyrics");
  if (latestDesktopLyricsPayload) {
    desktopLyricsWindow.webContents.send("desktop-lyrics:update", latestDesktopLyricsPayload);
  }
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
      onProgress: (progress) => event.sender.send("library:scan-progress", progress)
    });
  });

  ipcMain.handle("library:rescan", async (event, folderPath: string) => {
    return scanMusicFolder(folderPath, {
      onProgress: (progress) => event.sender.send("library:scan-progress", progress)
    });
  });

  ipcMain.handle("media:get-playable-url", (_event, filePath: string) => {
    return toMediaFileUrl(filePath);
  });

  ipcMain.handle("media:get-artwork-url", (_event, filePath: string | null) => {
    return toOptionalFileUrl(filePath);
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

  ipcMain.handle("desktop-lyrics:open-settings", () => {
    mainWindow?.show();
    mainWindow?.focus();
    mainWindow?.webContents.send("library:menu-command", "open-settings");
  });
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
  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
    closeDesktopLyricsWindow();
  });

  await loadRendererWindow(win);
  if (process.env.VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools({ mode: "detach" });
  }
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
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
