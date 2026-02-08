import {
  GetVersionsFn,
  GetWindowStateFn,
  OnWindowStateChangedFn,
  OnResizeStepFn,
  ResizeWindowFn,
  SetAlwaysOnTopFn,
  WindowControlFn,
  CreateServerFn,
  GetServersFn,
  GetServerFn,
  DeleteServerFn,
  OnServerCreationProgressFn,
  StartServerFn,
  StopServerFn,
  SendCommandFn,
  OnConsoleOutputFn,
  OnServerStatusFn,
  GetServerPropertiesFn,
  SaveServerPropertiesFn,
  GetWhitelistFn,
  SaveWhitelistFn,
  GetBanlistFn,
  SaveBanlistFn,
  UpdateServerSettingsFn,
  OpenServerFolderFn,
  OnServerStatsFn,
  AcceptEulaFn,
  ListServerFilesFn,
  ReadServerFileFn,
  WriteServerFileFn,
  DeleteServerFileFn,
  RenameServerFileFn,
  CopyServerFileFn,
  GetServerLogsFn,
  SearchModrinthFn,
  GetModrinthProjectFn,
  ListModrinthInstallsFn,
  InstallModrinthProjectFn,
  UpdateModrinthInstallFn,
  RemoveModrinthInstallFn,
  OpenExternalFn,
  CheckForUpdatesFn,
} from "@shared/types";

// Type definition for the preload process
declare global {
  interface Window {
    context: {
      getVersions: GetVersionsFn;
      triggerIPC: () => void;
      resizeWindow: ResizeWindowFn;
      windowControl: WindowControlFn;
      getWindowState: GetWindowStateFn;
      setAlwaysOnTop: SetAlwaysOnTopFn;
      onWindowStateChanged: OnWindowStateChangedFn;
      onResizeStep: OnResizeStepFn;
      createServer: CreateServerFn;
      getServers: GetServersFn;
      getServer: GetServerFn;
      deleteServer: DeleteServerFn;
      onServerCreationProgress: OnServerCreationProgressFn;
      getServerLogs: GetServerLogsFn;
      startServer: StartServerFn;
      stopServer: StopServerFn;
      sendCommand: SendCommandFn;
      onConsoleOutput: OnConsoleOutputFn;
      onServerStatus: OnServerStatusFn;
      getServerProperties: GetServerPropertiesFn;
      saveServerProperties: SaveServerPropertiesFn;
      getWhitelist: GetWhitelistFn;
      saveWhitelist: SaveWhitelistFn;
      getBanlist: GetBanlistFn;
      saveBanlist: SaveBanlistFn;
      updateServerSettings: UpdateServerSettingsFn;
      openServerFolder: OpenServerFolderFn;
      onServerStats: OnServerStatsFn;
      acceptEula: AcceptEulaFn;
      listServerFiles: ListServerFilesFn;
      readServerFile: ReadServerFileFn;
      writeServerFile: WriteServerFileFn;
      deleteServerFile: DeleteServerFileFn;
      renameServerFile: RenameServerFileFn;
      copyServerFile: CopyServerFileFn;
      searchModrinth: SearchModrinthFn;
      getModrinthProject: GetModrinthProjectFn;
      listModrinthInstalls: ListModrinthInstallsFn;
      installModrinthProject: InstallModrinthProjectFn;
      updateModrinthInstall: UpdateModrinthInstallFn;
      removeModrinthInstall: RemoveModrinthInstallFn;
      openExternal: OpenExternalFn;
      checkForUpdates: CheckForUpdatesFn;
    };
  }
}
