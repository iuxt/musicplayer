import { app, BrowserWindow, dialog, ipcMain, Menu, shell, type MenuItemConstructorOptions, type OpenDialogOptions } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readLyricsFile, toMediaFileUrl, toOptionalFileUrl } from "../src/main/fileUrls.js";
import { writeTrackMetadata } from "../src/main/metadataWriter.js";
import { scanMusicFolder } from "../src/main/scanner.js";
import { trashTrackFiles, trashTrackLyrics } from "../src/main/trackFileActions.js";
import type { Track, TrackMetadataUpdate } from "../src/shared/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appIconPath = path.join(__dirname, "../../build/app-icon.png");

type MenuCommand = "choose-folder" | "rescan-library";

function sendMenuCommand(command: MenuCommand) {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  targetWindow?.webContents.send("library:menu-command", command);
}

function createApplicationMenu() {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
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

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await win.loadURL(devServerUrl);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(path.join(__dirname, "../../dist/index.html"));
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
