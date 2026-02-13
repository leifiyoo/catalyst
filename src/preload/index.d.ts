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
  RestartServerFn,
  ExportServerFn,
  ImportServerFn,
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
  CreateBackupFn,
  GetBackupsFn,
  DeleteBackupFn,
  RestoreBackupFn,
  CancelBackupFn,
  GetBackupStatusFn,
  IsBackupInProgressFn,
  OnBackupProgressFn,
  OnBackupCompletedFn,
  LogToMainFn,
  InstallNgrokFn,
  StartNgrokFn,
  StopNgrokFn,
  GetNgrokStatusFn,
  OnNgrokUrlChangedFn,
  GetLocalIpFn,
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
      restartServer: RestartServerFn;
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
      exportServer: ExportServerFn;
      importServer: ImportServerFn;
      openImportDialog: () => Promise<{ success: boolean; error?: string; filePath?: string }>;
      getServerDiskUsage: (serverId: string) => Promise<{ success: boolean; bytes?: number; error?: string }>;
      readAnalyticsData: (serverId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
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
      createBackup: CreateBackupFn;
      getBackups: GetBackupsFn;
      deleteBackup: DeleteBackupFn;
      restoreBackup: RestoreBackupFn;
      cancelBackup: CancelBackupFn;
      getBackupStatus: GetBackupStatusFn;
      isBackupInProgress: IsBackupInProgressFn;
      onBackupProgress: OnBackupProgressFn;
      onBackupCompleted: OnBackupCompletedFn;
      logToMain: LogToMainFn;
      installNgrok: InstallNgrokFn;
      startNgrok: StartNgrokFn;
      stopNgrok: StopNgrokFn;
      getNgrokStatus: GetNgrokStatusFn;
      getLocalIp: GetLocalIpFn;
      onNgrokUrlChanged: OnNgrokUrlChangedFn;
      onNgrokInstallProgress: (handler: (data: { percent: number }) => void) => () => void;
      configureNgrokAuthtoken: (authtoken: string) => Promise<{ success: boolean; error?: string }>;
      isNgrokAuthtokenConfigured: () => Promise<boolean>;
      validateNgrokAuthtoken: (authtoken: string) => Promise<{ valid: boolean; error?: string }>;
      getNgrokAuthtokenCensored: () => Promise<string | null>;
      isNgrokEnabled: () => Promise<boolean>;
      setNgrokEnabled: (enabled: boolean) => Promise<void>;
      removeNgrokAuthtoken: () => Promise<{ success: boolean; error?: string }>;
    };
  }
}
