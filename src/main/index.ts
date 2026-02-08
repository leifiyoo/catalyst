import { app, shell, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { electronApp, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import {
  getVersions,
  triggerIPC,
  createServer,
  getServers,
  getServer,
  deleteServer,
  startServer,
  stopServer,
  sendCommand,
  stopAllServers,
  getServerProperties,
  saveServerProperties,
  getWhitelist,
  saveWhitelist,
  getBanlist,
  saveBanlist,
  updateServerSettings,
  refreshServerStatuses,
  acceptEula,
  listServerFiles,
  readServerFile,
  writeServerFile,
  deleteServerFile,
  renameServerFile,
  copyServerFile,
  getServerLogs,
  searchModrinthProjects,
  getModrinthProjectDetails,
  listModrinthInstalls,
  installModrinthProject,
  updateModrinthInstall,
  removeModrinthInstall,
  checkForUpdates,
} from "@/lib";
import {
  GetVersionsFn,
  WindowControlAction,
  CreateServerParams,
  ServerProperty,
} from "@shared/types";

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    minWidth: 800,
    minHeight: 500,
    frame: false,
    show: false,
    autoHideMenuBar: true,
    alwaysOnTop: true,
    backgroundColor: '#000000',
    vibrancy: "under-window",
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      devTools: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  const sendWindowState = () => {
    mainWindow.webContents.send("windowStateChanged", {
      isMaximized: mainWindow.isMaximized()
    });
  };

  mainWindow.on("maximize", sendWindowState);
  mainWindow.on("unmaximize", sendWindowState);
  mainWindow.on("restore", sendWindowState);
  mainWindow.on("ready-to-show", sendWindowState);

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron");

  // DevTools disabled
  // app.on("browser-window-created", (_, window) => {
  //   optimizer.watchWindowShortcuts(window);
  // });

  createWindow();

  // Clean up stale "Online" statuses from previous session
  const mainWin = BrowserWindow.getAllWindows()[0];
  if (mainWin) {
    mainWin.webContents.once("did-finish-load", () => {
      refreshServerStatuses(mainWin);
    });
  }

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // IPC events
  ipcMain.handle(
    "getVersions",
    (_, ...args: Parameters<GetVersionsFn>) => getVersions(...args)
  );

  ipcMain.handle("triggerIPC", () => triggerIPC());

  ipcMain.handle("resizeWindow", async () => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) return;

    if (!mainWindow.isMaximized()) {
      mainWindow.maximize();
    }
  });

  ipcMain.handle("setAlwaysOnTop", (_event, value: boolean) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) return;
    mainWindow.setAlwaysOnTop(Boolean(value));
  });

  ipcMain.handle("getWindowState", () => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) return { isMaximized: false };
    return { isMaximized: mainWindow.isMaximized() };
  });

  ipcMain.handle("windowControl", (_event, action: WindowControlAction) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) return;

    switch (action) {
      case "minimize":
        mainWindow.minimize();
        break;
      case "toggle-maximize":
        mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
        break;
      case "close":
        mainWindow.close();
        break;
      default:
        break;
    }
  });

  // Server management IPC
  ipcMain.handle("createServer", async (_event, params: CreateServerParams) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) {
      return { success: false, error: "No window available" };
    }
    return createServer(params, mainWindow);
  });

  ipcMain.handle("getServers", async () => {
    return getServers();
  });

  ipcMain.handle("deleteServer", async (_event, serverId: string) => {
    return deleteServer(serverId);
  });

  ipcMain.handle("getServer", async (_event, id: string) => {
    return getServer(id);
  });

  ipcMain.handle("startServer", async (_event, id: string) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) {
      return { success: false, error: "No window available" };
    }
    return startServer(id, mainWindow);
  });

  ipcMain.handle("stopServer", async (_event, id: string) => {
    return stopServer(id);
  });

  ipcMain.handle("sendCommand", async (_event, id: string, command: string) => {
    sendCommand(id, command);
  });

  ipcMain.handle("getServerProperties", async (_event, id: string) => {
    const server = await getServer(id);
    if (!server) return [];
    return getServerProperties(server.serverPath);
  });

  ipcMain.handle("saveServerProperties", async (_event, id: string, properties: ServerProperty[]) => {
    const server = await getServer(id);
    if (!server) return { success: false, error: "Server not found" };
    return saveServerProperties(server.serverPath, properties);
  });

  ipcMain.handle("getWhitelist", async (_event, id: string) => {
    const server = await getServer(id);
    if (!server) return [];
    return getWhitelist(server.serverPath);
  });

  ipcMain.handle("saveWhitelist", async (_event, id: string, players: string[]) => {
    const server = await getServer(id);
    if (!server) return { success: false, error: "Server not found" };
    return saveWhitelist(server.serverPath, players);
  });

  ipcMain.handle("getBanlist", async (_event, id: string) => {
    const server = await getServer(id);
    if (!server) return [];
    return getBanlist(server.serverPath);
  });

  ipcMain.handle("saveBanlist", async (_event, id: string, players: string[]) => {
    const server = await getServer(id);
    if (!server) return { success: false, error: "Server not found" };
    return saveBanlist(server.serverPath, players);
  });

  ipcMain.handle("updateServerSettings", async (_event, id: string, settings: { ramMB?: number }) => {
    return updateServerSettings(id, settings);
  });

  ipcMain.handle("openServerFolder", async (_event, id: string) => {
    const server = await getServer(id);
    if (server) {
      shell.openPath(server.serverPath);
    }
  });

  ipcMain.handle("acceptEula", async (_event, serverId: string) => {
    return acceptEula(serverId);
  });

  ipcMain.handle("listServerFiles", async (_event, serverId: string, relativePath: string) => {
    return listServerFiles(serverId, relativePath);
  });

  ipcMain.handle("readServerFile", async (_event, serverId: string, relativePath: string) => {
    return readServerFile(serverId, relativePath);
  });

  ipcMain.handle("getServerLogs", async (_event, serverId: string) => {
    return getServerLogs(serverId);
  });

  ipcMain.handle("writeServerFile", async (_event, serverId: string, relativePath: string, content: string) => {
    return writeServerFile(serverId, relativePath, content);
  });

  ipcMain.handle("deleteServerFile", async (_event, serverId: string, relativePath: string) => {
    return deleteServerFile(serverId, relativePath);
  });

  ipcMain.handle("renameServerFile", async (_event, serverId: string, relativePath: string, newName: string) => {
    return renameServerFile(serverId, relativePath, newName);
  });

  ipcMain.handle("copyServerFile", async (_event, serverId: string, relativePath: string, newName: string) => {
    return copyServerFile(serverId, relativePath, newName);
  });

  ipcMain.handle("searchModrinth", async (_event, params) => {
    return searchModrinthProjects(params);
  });

  ipcMain.handle("getModrinthProject", async (_event, projectId: string) => {
    return getModrinthProjectDetails(projectId);
  });

  ipcMain.handle("listModrinthInstalls", async (_event, id: string, projectType) => {
    const server = await getServer(id);
    if (!server) return [];
    return listModrinthInstalls(server.serverPath, projectType);
  });

  ipcMain.handle("installModrinthProject", async (_event, id: string, request) => {
    const server = await getServer(id);
    if (!server) return { success: false, error: "Server not found" };
    return installModrinthProject(server.serverPath, request);
  });

  ipcMain.handle("updateModrinthInstall", async (_event, id: string, request) => {
    const server = await getServer(id);
    if (!server) return { success: false, updated: false, error: "Server not found" };
    return updateModrinthInstall(server.serverPath, request);
  });

  ipcMain.handle("checkForUpdates", () => {
    return checkForUpdates();
  });

  ipcMain.handle("removeModrinthInstall", async (_event, id: string, projectId: string) => {
    const server = await getServer(id);
    if (!server) return { success: false, error: "Server not found" };
    return removeModrinthInstall(server.serverPath, projectId);
  });

  ipcMain.handle("openExternal", async (_event, url: string) => {
    await shell.openExternal(url);
  });
});

// Graceful shutdown: stop all running MC servers before quitting
let isQuitting = false;
app.on("before-quit", async (e) => {
  if (!isQuitting) {
    isQuitting = true;
    e.preventDefault();
    try {
      await stopAllServers();
    } catch {
      // Ignore errors during shutdown
    }
    app.exit();
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", async () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
