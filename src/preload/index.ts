import { contextBridge } from "electron";
import { ipcRenderer } from "electron/renderer";
import {
  GetVersionsFn,
  GetWindowStateFn,
  OnWindowStateChangedFn,
  OnResizeStepFn,
  SetAlwaysOnTopFn,
  WindowControlFn,
  CreateServerFn,
  ServerCreationProgress,
  ConsoleLine,
  ServerStatusUpdate,
  ServerStats,
  ServerProperty,
  FileEntry,
  ModrinthSearchParams,
  ModrinthProjectType,
  ModrinthInstallRequest,
  ModrinthInstallResult,
  ModrinthUpdateResult,
  ModrinthSearchResult,
  ModrinthInstallEntry,
  ModrinthProjectDetails,
  BackupEntry,
  LogToMainFn,
  NgrokTunnelInfo,
} from "@shared/types";

// The preload process plays a middleware role in bridging
// the call from the front end, and the function in the main process

if (!process.contextIsolated) {
  throw new Error("Context isolation must be enabled in the Browser window");
}

try {
  // Front end can call the function by using window.context.<Function name>
  contextBridge.exposeInMainWorld("context", {
    getVersions: (...args: Parameters<GetVersionsFn>) =>
      ipcRenderer.invoke("getVersions", ...args),
    triggerIPC: () => ipcRenderer.invoke("triggerIPC"),
    resizeWindow: () => ipcRenderer.invoke("resizeWindow"),
    windowControl: (action: Parameters<WindowControlFn>[0]) =>
      ipcRenderer.invoke("windowControl", action),
    getWindowState: () => ipcRenderer.invoke("getWindowState"),
    setAlwaysOnTop: (value: Parameters<SetAlwaysOnTopFn>[0]) =>
      ipcRenderer.invoke("setAlwaysOnTop", value),
    onWindowStateChanged: (handler: Parameters<OnWindowStateChangedFn>[0]) => {
      const listener = (_event: unknown, state: Awaited<ReturnType<GetWindowStateFn>>) =>
        handler(state);
      ipcRenderer.on("windowStateChanged", listener);
      return () => ipcRenderer.removeListener("windowStateChanged", listener);
    },
    onResizeStep: (handler: Parameters<OnResizeStepFn>[0]) => {
      const listener = () => handler();
      ipcRenderer.on("windowResizeStep", listener);
      return () => ipcRenderer.removeListener("windowResizeStep", listener);
    },

    // Server management
    createServer: (params: Parameters<CreateServerFn>[0]) =>
      ipcRenderer.invoke("createServer", params),
    getServers: () => ipcRenderer.invoke("getServers"),
    deleteServer: (serverId: string) => ipcRenderer.invoke("deleteServer", serverId),
    onServerCreationProgress: (handler: (progress: ServerCreationProgress) => void) => {
      const listener = (_event: unknown, progress: ServerCreationProgress) =>
        handler(progress);
      ipcRenderer.on("serverCreationProgress", listener);
      return () => ipcRenderer.removeListener("serverCreationProgress", listener);
    },

    // Server detail
    getServer: (id: string) => ipcRenderer.invoke("getServer", id),
    startServer: (id: string) => ipcRenderer.invoke("startServer", id),
    stopServer: (id: string) => ipcRenderer.invoke("stopServer", id),
    sendCommand: (id: string, command: string) =>
      ipcRenderer.invoke("sendCommand", id, command),
    getServerLogs: (serverId: string) => ipcRenderer.invoke("getServerLogs", serverId),
    onConsoleOutput: (handler: (serverId: string, line: ConsoleLine) => void) => {
      const listener = (_event: unknown, serverId: string, line: ConsoleLine) =>
        handler(serverId, line);
      ipcRenderer.on("consoleOutput", listener);
      return () => ipcRenderer.removeListener("consoleOutput", listener);
    },
    onServerStatus: (handler: (update: ServerStatusUpdate) => void) => {
      const listener = (_event: unknown, update: ServerStatusUpdate) =>
        handler(update);
      ipcRenderer.on("serverStatus", listener);
      return () => ipcRenderer.removeListener("serverStatus", listener);
    },
    getServerProperties: (id: string) =>
      ipcRenderer.invoke("getServerProperties", id),
    saveServerProperties: (id: string, properties: ServerProperty[]) =>
      ipcRenderer.invoke("saveServerProperties", id, properties),
    getWhitelist: (id: string) => ipcRenderer.invoke("getWhitelist", id),
    saveWhitelist: (id: string, players: string[]) =>
      ipcRenderer.invoke("saveWhitelist", id, players),
    getBanlist: (id: string) => ipcRenderer.invoke("getBanlist", id),
    saveBanlist: (id: string, players: string[]) =>
      ipcRenderer.invoke("saveBanlist", id, players),
    updateServerSettings: (id: string, settings: { ramMB?: number; javaPath?: string; backupConfig?: any }) =>
      ipcRenderer.invoke("updateServerSettings", id, settings),
    openServerFolder: (id: string) =>
      ipcRenderer.invoke("openServerFolder", id),
    onServerStats: (handler: (stats: ServerStats) => void) => {
      const listener = (_event: unknown, stats: ServerStats) =>
        handler(stats);
      ipcRenderer.on("serverStats", listener);
      return () => ipcRenderer.removeListener("serverStats", listener);
    },
    acceptEula: (serverId: string) =>
      ipcRenderer.invoke("acceptEula", serverId),
    listServerFiles: (serverId: string, relativePath: string): Promise<FileEntry[]> =>
      ipcRenderer.invoke("listServerFiles", serverId, relativePath),
    readServerFile: (serverId: string, relativePath: string) =>
      ipcRenderer.invoke("readServerFile", serverId, relativePath),
    writeServerFile: (serverId: string, relativePath: string, content: string) =>
      ipcRenderer.invoke("writeServerFile", serverId, relativePath, content),
    deleteServerFile: (serverId: string, relativePath: string) =>
      ipcRenderer.invoke("deleteServerFile", serverId, relativePath),
    renameServerFile: (serverId: string, relativePath: string, newName: string) =>
      ipcRenderer.invoke("renameServerFile", serverId, relativePath, newName),
    copyServerFile: (serverId: string, relativePath: string, newName: string) =>
      ipcRenderer.invoke("copyServerFile", serverId, relativePath, newName),
    searchModrinth: (params: ModrinthSearchParams): Promise<ModrinthSearchResult> =>
      ipcRenderer.invoke("searchModrinth", params),
    getModrinthProject: (projectId: string): Promise<ModrinthProjectDetails> =>
      ipcRenderer.invoke("getModrinthProject", projectId),
    listModrinthInstalls: (
      serverId: string,
      projectType: ModrinthProjectType
    ): Promise<ModrinthInstallEntry[]> =>
      ipcRenderer.invoke("listModrinthInstalls", serverId, projectType),
    installModrinthProject: (
      serverId: string,
      request: ModrinthInstallRequest
    ): Promise<ModrinthInstallResult> =>
      ipcRenderer.invoke("installModrinthProject", serverId, request),
    updateModrinthInstall: (
      serverId: string,
      request: ModrinthInstallRequest
    ): Promise<ModrinthUpdateResult> =>
      ipcRenderer.invoke("updateModrinthInstall", serverId, request),
    removeModrinthInstall: (
      serverId: string,
      projectId: string
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke("removeModrinthInstall", serverId, projectId),
    
    createBackup: (serverId: string, name?: string): Promise<{ success: boolean; error?: string; backup?: BackupEntry; started?: boolean }> =>
      ipcRenderer.invoke("createBackup", serverId, name),
    getBackups: (serverId: string): Promise<BackupEntry[]> =>
      ipcRenderer.invoke("getBackups", serverId),
    deleteBackup: (serverId: string, filename: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke("deleteBackup", serverId, filename),
    restoreBackup: (serverId: string, filename: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke("restoreBackup", serverId, filename),
    cancelBackup: (serverId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("cancelBackup", serverId),
    getBackupStatus: (serverId: string): Promise<{ serverId: string; inProgress: boolean; percent: number; stage: string; error?: string } | undefined> =>
      ipcRenderer.invoke("getBackupStatus", serverId),
    isBackupInProgress: (serverId: string): Promise<boolean> =>
      ipcRenderer.invoke("isBackupInProgress", serverId),
    onBackupProgress: (handler: (data: { serverId: string; percent: number; stage?: string; processedFiles?: number; totalFiles?: number }) => void) => {
      const listener = (_event: unknown, data: { serverId: string; percent: number; stage?: string; processedFiles?: number; totalFiles?: number }) => handler(data);
      ipcRenderer.on("backupProgress", listener);
      return () => ipcRenderer.removeListener("backupProgress", listener);
    },
    onBackupCompleted: (handler: (data: { serverId: string; backup: BackupEntry }) => void) => {
      const listener = (_event: unknown, data: { serverId: string; backup: BackupEntry }) => handler(data);
      ipcRenderer.on("backupCompleted", listener);
      return () => ipcRenderer.removeListener("backupCompleted", listener);
    },

    logToMain: (message: Parameters<LogToMainFn>[0], data?: Parameters<LogToMainFn>[1]) =>
      ipcRenderer.send("rendererLog", { message, data }),

    openExternal: (url: string) => ipcRenderer.invoke("openExternal", url),
    checkForUpdates: () => ipcRenderer.invoke("checkForUpdates"),

    // Ngrok
    installNgrok: () => ipcRenderer.invoke("installNgrok"),
    startNgrok: (serverId: string, port: number) =>
      ipcRenderer.invoke("startNgrok", serverId, port),
    stopNgrok: (serverId: string) =>
      ipcRenderer.invoke("stopNgrok", serverId),
    getNgrokStatus: (serverId: string) =>
      ipcRenderer.invoke("getNgrokStatus", serverId),
    getLocalIp: () => ipcRenderer.invoke("getLocalIp"),
    onNgrokUrlChanged: (handler: (info: NgrokTunnelInfo) => void) => {
      const listener = (_event: unknown, info: NgrokTunnelInfo) => handler(info);
      ipcRenderer.on("ngrokUrlChanged", listener);
      return () => ipcRenderer.removeListener("ngrokUrlChanged", listener);
    },
    onNgrokInstallProgress: (handler: (data: { percent: number }) => void) => {
      const listener = (_event: unknown, data: { percent: number }) => handler(data);
      ipcRenderer.on("ngrokInstallProgress", listener);
      return () => ipcRenderer.removeListener("ngrokInstallProgress", listener);
    },
    configureNgrokAuthtoken: (authtoken: string) =>
      ipcRenderer.invoke("configureNgrokAuthtoken", authtoken),
    isNgrokAuthtokenConfigured: () =>
      ipcRenderer.invoke("isNgrokAuthtokenConfigured"),
    validateNgrokAuthtoken: (authtoken: string) =>
      ipcRenderer.invoke("validateNgrokAuthtoken", authtoken),
    getNgrokAuthtokenCensored: () =>
      ipcRenderer.invoke("getNgrokAuthtokenCensored"),
    isNgrokEnabled: () =>
      ipcRenderer.invoke("isNgrokEnabled"),
    setNgrokEnabled: (enabled: boolean) =>
      ipcRenderer.invoke("setNgrokEnabled", enabled),
    removeNgrokAuthtoken: () =>
      ipcRenderer.invoke("removeNgrokAuthtoken"),
  });
} catch (error) {
  console.error("Error occured when establishing context bridge: ", error);
}
