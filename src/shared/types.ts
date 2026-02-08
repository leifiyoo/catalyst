import { electronAPI } from "@electron-toolkit/preload";

export type GetVersionsFn = () => Promise<typeof electronAPI.process.versions>;
export type ResizeWindowFn = () => Promise<void>;
export type OnResizeStepFn = (handler: () => void) => () => void;
export type WindowControlAction = "minimize" | "toggle-maximize" | "close";
export type WindowControlFn = (action: WindowControlAction) => Promise<void>;
export type WindowState = { isMaximized: boolean };
export type GetWindowStateFn = () => Promise<WindowState>;
export type OnWindowStateChangedFn = (handler: (state: WindowState) => void) => () => void;
export type SetAlwaysOnTopFn = (value: boolean) => Promise<void>;

// ---- Server Types ----

export type ServerRecord = {
  id: string;
  name: string;
  framework: string;
  version: string;
  ramMB: number;
  status: "Online" | "Idle" | "Offline";
  players: string;
  createdAt: string;
  serverPath: string;
  eulaAccepted?: boolean;
  jarFile?: string;
  javaPath?: string;
};

export type FileEntry = {
  name: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
};

export type CreateServerParams = {
  name: string;
  framework: string;
  version: string;
  ramMB: number;
};

export type ServerCreationProgress = {
  stage: "creating-folder" | "downloading" | "writing-files" | "setup-java" | "done" | "error";
  message: string;
  percent: number;
  bytesDownloaded?: number;
  bytesTotal?: number;
};

export type CreateServerResult = {
  success: boolean;
  server?: ServerRecord;
  error?: string;
};

export type ConsoleLine = {
  timestamp: string;
  text: string;
  type: "stdout" | "stderr" | "system";
};

export type ServerStatusUpdate = {
  serverId: string;
  status: "Online" | "Offline";
  players?: string;
};

export type ServerStats = {
  serverId: string;
  tps: number | null;
  memoryUsedMB: number | null;
  memoryMaxMB: number | null;
  onlinePlayers: string[];
  playerCount: number;
  maxPlayers: number;
};

export type ServerProperty = {
  key: string;
  value: string;
  comment?: string;
};

// ---- Modrinth Types ----

export type ModrinthProjectType = "plugin" | "mod";

export type ModrinthSearchParams = {
  query: string;
  projectType: ModrinthProjectType;
  loader?: string;
  gameVersion?: string;
  limit?: number;
  offset?: number;
  sort?: "relevance" | "downloads" | "updated" | "newest";
};

export type ModrinthSearchHit = {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  iconUrl?: string;
  categories?: string[];
  clientSide?: string;
  serverSide?: string;
  downloads: number;
  follows: number;
  author: string;
  dateModified: string;
};

export type ModrinthSearchResult = {
  hits: ModrinthSearchHit[];
  totalHits: number;
};

export type ModrinthInstallRequest = {
  projectId: string;
  projectType: ModrinthProjectType;
  loader?: string;
  gameVersion?: string;
  title?: string;
  slug?: string;
  iconUrl?: string;
};

export type ModrinthInstallEntry = {
  projectId: string;
  versionId: string;
  fileName: string;
  title: string;
  slug?: string;
  iconUrl?: string;
  projectType: ModrinthProjectType;
  loader?: string;
  gameVersion?: string;
  installedAt: string;
};

export type ModrinthInstallResult = {
  success: boolean;
  entry?: ModrinthInstallEntry;
  error?: string;
};

export type ModrinthUpdateResult = {
  success: boolean;
  updated: boolean;
  entry?: ModrinthInstallEntry;
  error?: string;
};

export type ModrinthGalleryImage = {
  url: string;
  title?: string;
  description?: string;
  featured?: boolean;
};

export type ModrinthProjectDetails = {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  iconUrl?: string;
  downloads: number;
  followers: number;
  clientSide?: string;
  serverSide?: string;
  categories?: string[];
  projectUrl?: string;
  sourceUrl?: string;
  issuesUrl?: string;
  wikiUrl?: string;
  gallery: ModrinthGalleryImage[];
};

export type CreateServerFn = (params: CreateServerParams) => Promise<CreateServerResult>;
export type GetServersFn = () => Promise<ServerRecord[]>;
export type GetServerFn = (id: string) => Promise<ServerRecord | null>;
export type DeleteServerFn = (serverId: string) => Promise<{ success: boolean; error?: string }>;
export type OnServerCreationProgressFn = (
  handler: (progress: ServerCreationProgress) => void
) => () => void;
export type StartServerFn = (id: string) => Promise<{ success: boolean; error?: string }>;
export type StopServerFn = (id: string) => Promise<{ success: boolean; error?: string }>;
export type SendCommandFn = (id: string, command: string) => Promise<void>;
export type OnConsoleOutputFn = (handler: (serverId: string, line: ConsoleLine) => void) => () => void;
export type OnServerStatusFn = (handler: (update: ServerStatusUpdate) => void) => () => void;
export type GetServerPropertiesFn = (id: string) => Promise<ServerProperty[]>;
export type SaveServerPropertiesFn = (id: string, properties: ServerProperty[]) => Promise<{ success: boolean; error?: string }>;
export type GetWhitelistFn = (id: string) => Promise<string[]>;
export type SaveWhitelistFn = (id: string, players: string[]) => Promise<{ success: boolean; error?: string }>;
export type GetBanlistFn = (id: string) => Promise<string[]>;
export type SaveBanlistFn = (id: string, players: string[]) => Promise<{ success: boolean; error?: string }>;
export type UpdateServerSettingsFn = (id: string, settings: { ramMB?: number; javaPath?: string }) => Promise<{ success: boolean; error?: string }>;
export type OpenServerFolderFn = (id: string) => Promise<void>;
export type OnServerStatsFn = (handler: (stats: ServerStats) => void) => () => void;
export type AcceptEulaFn = (serverId: string) => Promise<{ success: boolean; error?: string }>;
export type ListServerFilesFn = (serverId: string, relativePath: string) => Promise<FileEntry[]>;
export type ReadServerFileFn = (serverId: string, relativePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
export type WriteServerFileFn = (serverId: string, relativePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
export type DeleteServerFileFn = (serverId: string, relativePath: string) => Promise<{ success: boolean; error?: string }>;
export type RenameServerFileFn = (serverId: string, relativePath: string, newName: string) => Promise<{ success: boolean; error?: string }>;
export type CopyServerFileFn = (serverId: string, relativePath: string, newName: string) => Promise<{ success: boolean; error?: string }>;
export type GetServerLogsFn = (serverId: string) => Promise<ConsoleLine[]>;
export type SearchModrinthFn = (params: ModrinthSearchParams) => Promise<ModrinthSearchResult>;
export type ListModrinthInstallsFn = (serverId: string, projectType: ModrinthProjectType) => Promise<ModrinthInstallEntry[]>;
export type InstallModrinthProjectFn = (serverId: string, request: ModrinthInstallRequest) => Promise<ModrinthInstallResult>;
export type UpdateModrinthInstallFn = (serverId: string, request: ModrinthInstallRequest) => Promise<ModrinthUpdateResult>;
export type RemoveModrinthInstallFn = (serverId: string, projectId: string) => Promise<{ success: boolean; error?: string }>;
export type GetModrinthProjectFn = (projectId: string) => Promise<ModrinthProjectDetails>;
export type OpenExternalFn = (url: string) => Promise<void>;

export type UpdateCheckResult = {
  updateAvailable: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseUrl: string;
  error?: string;
};

export type CheckForUpdatesFn = () => Promise<UpdateCheckResult>;
