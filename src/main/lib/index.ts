import { electronAPI } from "@electron-toolkit/preload";
import { GetVersionsFn } from "@shared/types";

// Thie file stores functions used for the front-end
// to communicate with the main process directly

export const getVersions: GetVersionsFn = async () => {
  const versions = electronAPI.process.versions;
  return versions;
};

export const triggerIPC = () => {
  // no-op: reserved for IPC testing
};

export {
  createServer,
  getServers,
  getServer,
  deleteServer,
  getServerProperties,
  saveServerProperties,
  getWhitelist,
  saveWhitelist,
  getBanlist,
  saveBanlist,
  updateServerSettings,
} from "./server-manager";

export {
  startServer,
  stopServer,
  sendCommand,
  stopAllServers,
  refreshServerStatuses,
  getServerLogs,
  restartServer,
} from "./server-runner";

export {
  acceptEula,
  listServerFiles,
  readServerFile,
  writeServerFile,
  deleteServerFile,
  renameServerFile,
  copyServerFile,
} from "./server-manager";

export {
  createBackup,
  getBackups,
  deleteBackup,
  restoreBackup,
  checkAndRunAutoBackups,
  cancelBackup,
  getBackupStatus,
  isBackupInProgress
} from "./backup-manager";

export {
  searchModrinthProjects,
  getModrinthProjectDetails,
  listModrinthInstalls,
  installModrinthProject,
  updateModrinthInstall,
  removeModrinthInstall,
} from "./modrinth";

export { checkForUpdates } from "./update-checker";
