import { app, BrowserWindow, dialog } from "electron";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { createWriteStream, existsSync } from "fs";
import https from "https";
import http from "http";
import crypto from "crypto";
import archiver from "archiver";
import AdmZip from "adm-zip";
import {
  AnalyticsData,
  CreateServerParams,
  CreateServerResult,
  FileEntry,
  ServerCreationProgress,
  ServerProperty,
  ServerRecord,
} from "@shared/types";
import { getRequiredJavaVersion, ensureJavaInstalled } from "./java-manager";

// ---- CatalystAnalytics Plugin Helper ----

/**
 * Returns the path to the bundled CatalystAnalytics.jar.
 * In production the file lives inside the unpacked asar resources folder;
 * in development it sits at <project>/resources/plugins/.
 */
function getCatalystPluginJarPath(): string {
  // In production: process.resourcesPath points to <app>/resources
  // The JAR is in the asarUnpack'd resources/plugins/ folder.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "plugins", "CatalystAnalytics.jar");
  }
  // In development: app.getAppPath() points to the project root
  return path.join(app.getAppPath(), "resources", "plugins", "CatalystAnalytics.jar");
}

/**
 * Copies the CatalystAnalytics plugin JAR into the server's plugins/ directory.
 * Only installs for plugin-compatible frameworks (Paper, Purpur).
 * Returns true if the plugin was installed, false otherwise.
 */
export async function installCatalystPlugin(serverPath: string): Promise<boolean> {
  const srcJar = getCatalystPluginJarPath();
  if (!existsSync(srcJar)) {
    console.warn("CatalystAnalytics JAR not found at", srcJar);
    return false;
  }

  const pluginsDir = path.join(serverPath, "plugins");
  await fs.mkdir(pluginsDir, { recursive: true });

  const destJar = path.join(pluginsDir, "CatalystAnalytics.jar");
  await fs.copyFile(srcJar, destJar);
  return true;
}

/**
 * Removes the CatalystAnalytics plugin JAR from the server's plugins/ directory.
 */
export async function uninstallCatalystPlugin(serverPath: string): Promise<void> {
  const destJar = path.join(serverPath, "plugins", "CatalystAnalytics.jar");
  try {
    await fs.unlink(destJar);
  } catch {
    // Ignore if not present
  }
}

/**
 * Reads the analytics.json file written by the CatalystAnalytics plugin.
 * The file is located at <serverPath>/plugins/CatalystAnalytics/data/analytics.json
 */
export async function getAnalyticsData(
  serverId: string
): Promise<{ success: boolean; data?: AnalyticsData; error?: string }> {
  try {
    const server = await getServer(serverId);
    if (!server) {
      return { success: false, error: "Server not found" };
    }

    const analyticsPath = path.join(
      server.serverPath,
      "plugins",
      "CatalystAnalytics",
      "data",
      "analytics.json"
    );

    if (!existsSync(analyticsPath)) {
      return { success: false, error: "no-data" };
    }

    const content = await fs.readFile(analyticsPath, "utf-8");
    const data = JSON.parse(content) as AnalyticsData;
    return { success: true, data };
  } catch (err) {
    console.error("Failed to read analytics data:", err);
    return { success: false, error: "Failed to read analytics data" };
  }
}

const SERVERS_DIR = path.join(app.getPath("userData"), "servers");
const SERVERS_JSON = path.join(app.getPath("userData"), "servers.json");
const SERVERS_JSON_BAK = path.join(app.getPath("userData"), "servers.json.bak");
const SERVERS_JSON_TMP = path.join(app.getPath("userData"), "servers.json.tmp");

// Backup rotation settings
const MAX_BACKUP_COUNT = 5;
const getBackupPath = (index: number) => path.join(app.getPath("userData"), `servers.json.bak.${index}`);

/**
 * Performs backup rotation:
 * - Keeps up to MAX_BACKUP_COUNT numbered backups (servers.json.bak.0, .bak.1, etc.)
 * - The most recent backup is .bak.0, oldest is .bak.MAX_BACKUP_COUNT-1
 * - Also maintains a single servers.json.bak for compatibility
 */
async function rotateBackups(): Promise<void> {
  try {
    // First, try to copy current file to .bak.0
    try {
      await fs.copyFile(SERVERS_JSON, getBackupPath(0));
    } catch {
      // No current file to backup, skip
    }

    // Shift existing backups: .bak.4 -> .bak.5 (deleted), .bak.3 -> .bak.4, etc.
    for (let i = MAX_BACKUP_COUNT - 1; i >= 0; i--) {
      const currentPath = getBackupPath(i);
      const nextPath = getBackupPath(i + 1);

      try {
        await fs.access(currentPath);
        // Current backup exists
        if (i === MAX_BACKUP_COUNT - 1) {
          // This is the oldest backup, delete it
          await fs.unlink(currentPath);
        } else {
          // Shift this backup up
          await fs.copyFile(currentPath, nextPath);
        }
      } catch {
        // Backup doesn't exist, skip
      }
    }

    // Also maintain single .bak file for compatibility
    try {
      await fs.copyFile(getBackupPath(0), SERVERS_JSON_BAK);
    } catch {
      // Ignore if .bak.0 doesn't exist
    }

  } catch (err) {
    console.warn('[ServerManager] Backup rotation failed:', err);
    // Non-fatal, continue anyway
  }
}

/**
 * Tries to load backups in order of recency.
 */
async function tryLoadNumberedBackups(): Promise<ServerRecord[] | null> {
  // Try numbered backups first (most recent first)
  for (let i = 0; i < MAX_BACKUP_COUNT; i++) {
    try {
      const backupPath = getBackupPath(i);
      const data = await fs.readFile(backupPath, 'utf-8');
      if (isValidJson(data)) {
        const records = JSON.parse(data) as unknown[];
        const validRecords = validateServerRecords(records);
        if (validRecords.length > 0) {
          console.log('[ServerManager] Recovered from backup', i, 'with', validRecords.length, 'servers');
          return validRecords;
        }
      }
    } catch {
      // Backup doesn't exist or is invalid, try next
    }
  }
  return null;
}

// ---- Framework Download Resolvers ----

const PAPER_API_BASE = "https://api.papermc.io/v2/projects/paper";
const PURPUR_API_BASE = "https://api.purpurmc.org/v2/purpur";
const VANILLA_MANIFEST_URL = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const FABRIC_META_URL = "https://meta.fabricmc.net/v2";

type FrameworkDownloadResult = {
  url: string;
  filename: string;
  jarFile: string; // the main jar to launch
  requiresInstaller?: boolean;
  installerArgs?: string[];
};

async function getPaperDownloadUrl(version: string): Promise<FrameworkDownloadResult> {
  const buildsUrl = `${PAPER_API_BASE}/versions/${version}/builds`;
  const res = await fetch(buildsUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch Paper builds for ${version}: ${res.status}`);
  }
  const data = (await res.json()) as {
    builds: Array<{
      build: number;
      channel: string;
      downloads: { application: { name: string; sha256: string } };
    }>;
  };

  const stableBuilds = data.builds.filter((b) => b.channel === "default");
  const latestBuild = stableBuilds.length > 0
    ? stableBuilds[stableBuilds.length - 1]
    : data.builds[data.builds.length - 1];

  if (!latestBuild) {
    throw new Error(`No builds found for Paper ${version}`);
  }

  const filename = latestBuild.downloads.application.name;
  const url = `${PAPER_API_BASE}/versions/${version}/builds/${latestBuild.build}/downloads/${filename}`;
  return { url, filename, jarFile: "server.jar" };
}

async function getPurpurDownloadUrl(version: string): Promise<FrameworkDownloadResult> {
  const url = `${PURPUR_API_BASE}/${version}/latest/download`;
  return { url, filename: `purpur-${version}.jar`, jarFile: "server.jar" };
}

async function getVanillaDownloadUrl(version: string): Promise<FrameworkDownloadResult> {
  const manifestRes = await fetch(VANILLA_MANIFEST_URL);
  if (!manifestRes.ok) {
    throw new Error(`Failed to fetch Minecraft version manifest: ${manifestRes.status}`);
  }
  const manifest = (await manifestRes.json()) as {
    versions: Array<{ id: string; url: string }>;
  };

  const versionEntry = manifest.versions.find((v) => v.id === version);
  if (!versionEntry) {
    throw new Error(`Vanilla version ${version} not found in manifest`);
  }

  const versionRes = await fetch(versionEntry.url);
  if (!versionRes.ok) {
    throw new Error(`Failed to fetch version details for ${version}: ${versionRes.status}`);
  }
  const versionData = (await versionRes.json()) as {
    downloads: { server: { url: string; sha1: string; size: number } };
  };

  if (!versionData.downloads?.server) {
    throw new Error(`No server download available for Vanilla ${version}`);
  }

  return {
    url: versionData.downloads.server.url,
    filename: `server-${version}.jar`,
    jarFile: "server.jar",
  };
}

async function getFabricDownloadUrl(version: string): Promise<FrameworkDownloadResult> {
  // Get the latest stable Fabric loader version
  const loaderRes = await fetch(`${FABRIC_META_URL}/versions/loader`);
  if (!loaderRes.ok) {
    throw new Error(`Failed to fetch Fabric loader versions: ${loaderRes.status}`);
  }
  const loaders = (await loaderRes.json()) as Array<{ version: string; stable: boolean }>;
  const stableLoader = loaders.find((l) => l.stable);
  if (!stableLoader) {
    throw new Error("No stable Fabric loader found");
  }

  // Get the latest installer version
  const installerRes = await fetch(`${FABRIC_META_URL}/versions/installer`);
  if (!installerRes.ok) {
    throw new Error(`Failed to fetch Fabric installer versions: ${installerRes.status}`);
  }
  const installers = (await installerRes.json()) as Array<{ version: string; stable: boolean }>;
  const stableInstaller = installers.find((i) => i.stable);
  if (!stableInstaller) {
    throw new Error("No stable Fabric installer found");
  }

  // Use the server launcher endpoint which is a single downloadable JAR
  const url = `${FABRIC_META_URL}/versions/loader/${version}/${stableLoader.version}/${stableInstaller.version}/server/jar`;
  return {
    url,
    filename: `fabric-server-mc.${version}-loader.${stableLoader.version}-launcher.${stableInstaller.version}.jar`,
    jarFile: `fabric-server-mc.${version}-loader.${stableLoader.version}-launcher.${stableInstaller.version}.jar`,
  };
}

async function resolveFrameworkDownload(
  framework: string,
  version: string
): Promise<FrameworkDownloadResult> {
  switch (framework) {
    case "Paper":
      return getPaperDownloadUrl(version);
    case "Purpur":
      return getPurpurDownloadUrl(version);
    case "Vanilla":
      return getVanillaDownloadUrl(version);
    case "Fabric":
      return getFabricDownloadUrl(version);
    default:
      throw new Error(`Unsupported framework: ${framework}`);
  }
}

// ---- Helpers ----

function sanitizeServerName(name: string): string {
  let sanitized = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "");
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, "");
  sanitized = sanitized.substring(0, 64);
  if (!sanitized) sanitized = "server";
  return sanitized;
}

function validateServerPath(serverPath: string): boolean {
  const resolved = path.resolve(serverPath);
  const serversResolved = path.resolve(SERVERS_DIR);
  return resolved.startsWith(serversResolved + path.sep) || resolved === serversResolved;
}

/**
 * Validate that a resolved path is within the given root directory.
 * Prevents path traversal attacks.
 */
function isPathWithin(targetPath: string, rootPath: string): boolean {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootPath);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep);
}

function isEnoent(err: unknown): boolean {
  return err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT";
}

async function ensureServersJson(): Promise<void> {
  const dir = path.dirname(SERVERS_JSON);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(SERVERS_JSON, "[]", "utf-8");
}

/**
 * Validates that a string is valid JSON and can be parsed.
 * Returns true if valid, false otherwise.
 */
function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a server record has required fields.
 */
function isValidServerRecord(record: unknown): record is ServerRecord {
  if (!record || typeof record !== 'object') return false;
  const r = record as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.name === 'string' &&
    typeof r.serverPath === 'string' &&
    typeof r.framework === 'string' &&
    typeof r.version === 'string'
  );
}

/**
 * Validates a list of server records.
 * Returns only valid records and logs warnings for invalid ones.
 */
function validateServerRecords(records: unknown[]): ServerRecord[] {
  const valid: ServerRecord[] = [];
  for (const record of records) {
    if (isValidServerRecord(record)) {
      valid.push(record);
    } else {
      console.warn('[ServerManager] Invalid server record found and skipped:', record);
    }
  }
  return valid;
}

/**
 * Checks if a server's folder exists on disk.
 * Returns true if exists, false otherwise.
 */
async function validateServerFolder(server: ServerRecord): Promise<boolean> {
  try {
    await fs.access(server.serverPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempts to recover server records from the backup file.
 */
async function tryLoadBackup(): Promise<ServerRecord[] | null> {
  try {
    const backupData = await fs.readFile(SERVERS_JSON_BAK, 'utf-8');
    if (isValidJson(backupData)) {
      const records = JSON.parse(backupData) as unknown[];
      const validRecords = validateServerRecords(records);
      if (validRecords.length > 0) {
        console.log('[ServerManager] Successfully recovered', validRecords.length, 'servers from backup');
        return validRecords;
      }
    }
  } catch (err) {
    console.warn('[ServerManager] Failed to load backup file:', err);
  }
  return null;
}

/**
 * Attempts to recover server records by scanning the servers directory for orphaned folders.
 * This is a last-resort recovery mechanism.
 * Note: This function takes alreadyLoadedServers as a parameter to avoid infinite recursion.
 */
async function recoverFromOrphanedFolders(alreadyLoadedServers: ServerRecord[]): Promise<ServerRecord[]> {
  console.log('[ServerManager] Attempting to recover servers from orphaned folders...');
  const recovered: ServerRecord[] = [];

  try {
    const entries = await fs.readdir(SERVERS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const serverPath = path.join(SERVERS_DIR, entry.name);

      // Check if this folder might be a server (has server.jar or similar)
      try {
        const files = await fs.readdir(serverPath);
        const hasJar = files.some(f => f.endsWith('.jar'));

        if (hasJar) {
          // Try to find an existing server with this path
          const existing = alreadyLoadedServers.find(s => s.serverPath === serverPath);

          if (existing) {
            recovered.push(existing);
          } else {
            // Create a new record for this orphaned folder
            const newServer: ServerRecord = {
              id: crypto.randomUUID(),
              name: entry.name,
              framework: 'Unknown',
              version: 'Unknown',
              ramMB: 2048,
              status: 'Offline',
              players: '0/0',
              createdAt: new Date().toISOString(),
              serverPath,
            };
            console.log('[ServerManager] Recovered orphaned server folder:', serverPath);
            recovered.push(newServer);
          }
        }
      } catch (err) {
        console.warn('[ServerManager] Could not scan folder:', serverPath, err);
      }
    }
  } catch (err) {
    console.error('[ServerManager] Failed to scan servers directory for recovery:', err);
  }

  return recovered;
}

async function loadServerList(): Promise<ServerRecord[]> {
  // First, try to load from primary file
  try {
    const data = await fs.readFile(SERVERS_JSON, 'utf-8');

    // Validate JSON integrity
    if (!isValidJson(data)) {
      console.error('[ServerManager] Primary servers.json is corrupted, trying backup...');
      throw new Error('Corrupted JSON');
    }

    const records = JSON.parse(data) as unknown[];
    const validRecords = validateServerRecords(records);

    // Validate each server's folder exists
    const validatedRecords: ServerRecord[] = [];
    for (const server of validRecords) {
      const folderExists = await validateServerFolder(server);
      if (folderExists) {
        validatedRecords.push(server);
      } else {
        console.warn('[ServerManager] Server folder not found for server:', server.name, server.serverPath);
        // Don't remove - mark as missing but keep record
        validatedRecords.push({ ...server, status: 'Offline' as const });
      }
    }

    console.log('[ServerManager] Loaded', validatedRecords.length, 'servers from primary file');
    return validatedRecords;

  } catch (err) {
    // Primary file failed, try numbered backups first
    console.warn('[ServerManager] Primary servers.json load failed, trying numbered backups:', err);

    const numberedBackupRecords = await tryLoadNumberedBackups();
    if (numberedBackupRecords) {
      return numberedBackupRecords;
    }

    // Try legacy single backup file
    console.warn('[ServerManager] Numbered backups failed, trying legacy backup file...');
    const backupRecords = await tryLoadBackup();
    if (backupRecords) {
      return backupRecords;
    }

    // Backup also failed, try to recover from orphaned folders
    console.warn('[ServerManager] Backup load failed, attempting recovery from orphaned folders...');
    const recoveredRecords = await recoverFromOrphanedFolders([]);
    if (recoveredRecords.length > 0) {
      // Save recovered records
      await saveServerList(recoveredRecords);
      return recoveredRecords;
    }

    // Everything failed - create new empty file but log error
    console.error('[ServerManager] ALL recovery attempts failed! Creating new empty server list.');
    await ensureServersJson();
    return [];
  }
}

async function saveServerList(servers: ServerRecord[]): Promise<void> {
  const payload = JSON.stringify(servers, null, 2);

  // Step 1: Validate the data is valid JSON before writing
  if (!isValidJson(payload)) {
    throw new Error('[ServerManager] Failed to serialize server list to valid JSON');
  }

  // Step 2: Write to temp file
  await fs.writeFile(SERVERS_JSON_TMP, payload, 'utf-8');

  // Step 3: Validate temp file was written correctly
  const tempData = await fs.readFile(SERVERS_JSON_TMP, 'utf-8');
  if (!isValidJson(tempData)) {
    // Temp file is corrupted, abort and don't touch original
    await fs.unlink(SERVERS_JSON_TMP).catch(() => {});
    throw new Error('[ServerManager] Temp file validation failed, aborting save');
  }

  // Step 4: Check if current file exists and preserve it as backup BEFORE rename
  let hadExistingFile = false;
  try {
    await fs.access(SERVERS_JSON);
    hadExistingFile = true;
    // Copy current to backup (only after validating temp)
    await fs.copyFile(SERVERS_JSON, SERVERS_JSON_BAK);
  } catch {
    // No existing file, that's fine
  }

  // Step 5: Atomically rename temp to current (this is the critical step)
  // On POSIX systems, rename is atomic if both files are on the same filesystem
  try {
    await fs.rename(SERVERS_JSON_TMP, SERVERS_JSON);
    console.log('[ServerManager] Successfully saved', servers.length, 'servers');

    // Step 6: Perform backup rotation after successful save
    await rotateBackups();
  } catch (err) {
    // Rename failed! This is critical.
    // Try to restore from backup if we had one
    console.error('[ServerManager] Atomic rename failed, attempting recovery:', err);

    if (hadExistingFile) {
      try {
        // Restore backup
        await fs.copyFile(SERVERS_JSON_BAK, SERVERS_JSON);
        console.log('[ServerManager] Restored server list from backup');
      } catch {
        // Both files might be corrupted, log error
        console.error('[ServerManager] CRITICAL: Failed to restore from backup!');
      }
    }

    // Clean up temp file if it still exists
    try {
      await fs.unlink(SERVERS_JSON_TMP);
    } catch {
      // Ignore
    }

    throw err;
  }
}

function downloadFile(
  url: string,
  destPath: string,
  onProgress: (downloaded: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        downloadFile(response.headers.location, destPath, onProgress)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }

      const totalBytes = parseInt(response.headers["content-length"] || "0", 10);
      let downloadedBytes = 0;

      const fileStream = createWriteStream(destPath);

      response.on("data", (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        onProgress(downloadedBytes, totalBytes);
      });

      response.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close();
        resolve();
      });

      fileStream.on("error", (err: Error) => {
        fs.unlink(destPath).catch(() => {});
        reject(err);
      });
    });

    request.on("error", (err) => {
      reject(err);
    });

    request.setTimeout(300000, () => {
      request.destroy();
      reject(new Error("Download timed out"));
    });
  });
}

function generateStartBat(ramMB: number, jarFile: string = "server.jar"): string {
  // Sanitize jarFile to prevent command injection in batch file
  const safeJarFile = jarFile.replace(/[^a-zA-Z0-9._\-]/g, "");
  const safeRam = Math.max(256, Math.min(65536, Math.floor(Number(ramMB) || 1024)));
  return `@echo off\r\njava -Xms${safeRam}M -Xmx${safeRam}M -XX:+AlwaysPreTouch -XX:+DisableExplicitGC -XX:+ParallelRefProcEnabled -XX:+PerfDisableSharedMem -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1HeapRegionSize=8M -XX:G1HeapWastePercent=5 -XX:G1MaxNewSizePercent=40 -XX:G1MixedGCCountTarget=4 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1NewSizePercent=30 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:G1ReservePercent=20 -XX:InitiatingHeapOccupancyPercent=15 -XX:MaxGCPauseMillis=200 -XX:MaxTenuringThreshold=1 -XX:SurvivorRatio=32 -Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true -jar ${safeJarFile} nogui\r\npause\r\n`;
}

// ---- Exports ----

export async function createServer(
  params: CreateServerParams,
  mainWindow: BrowserWindow
): Promise<CreateServerResult> {
  const sendProgress = (progress: ServerCreationProgress) => {
    mainWindow.webContents.send("serverCreationProgress", progress);
  };

  try {
    // 1. Create folder
    const folderName = sanitizeServerName(params.name);
    let serverDir = path.join(SERVERS_DIR, folderName);

    if (!validateServerPath(serverDir)) {
      return { success: false, error: "Invalid server name" };
    }

    // Handle name collision
    let finalDir = serverDir;
    let suffix = 1;
    while (true) {
      try {
        await fs.access(finalDir);
        finalDir = `${serverDir}-${suffix}`;
        suffix++;
      } catch {
        break;
      }
    }

    sendProgress({ stage: "creating-folder", message: "Creating server folder...", percent: 5 });
    await fs.mkdir(finalDir, { recursive: true });

    // 2. Resolve framework download URL
    sendProgress({ stage: "downloading", message: `Resolving ${params.framework} ${params.version} download...`, percent: 8 });
    const downloadInfo = await resolveFrameworkDownload(params.framework, params.version);

    // 2.5: Ensure Java is installed now (so we don't wait at first boot)
    sendProgress({ stage: "setup-java", message: `Checking required Java version...`, percent: 12 });
    const javaVersion = getRequiredJavaVersion(params.version);
    try {
        await ensureJavaInstalled(javaVersion, (stage, percent, downloaded, total) => {
            // Map Java setup to 12% - 20% range
            const overallPercent = 12 + (percent * 0.08);
            sendProgress({
                stage: "setup-java",
                message: stage === 'extracting' 
                    ? `Extracting Java ${javaVersion}...` 
                    : `Downloading Java ${javaVersion}... ${Math.round(percent)}%`,
                percent: overallPercent, 
                bytesDownloaded: downloaded,
                bytesTotal: total
            });
        });
    } catch(err) {
        console.error("Failed to pre-download Java:", err);
        // We don't fail the server creation if Java fails, we just log it.
        // It will try again at server start if needed.
    }

    // 3. Download JAR
    sendProgress({ stage: "downloading", message: `Downloading ${params.framework} ${params.version}...`, percent: 20 });

    // For Fabric, the jar filename is the launcher jar; for others, save as server.jar
    const destFilename = downloadInfo.jarFile === "server.jar" ? "server.jar" : downloadInfo.jarFile;
    const jarPath = path.join(finalDir, destFilename);
    await downloadFile(downloadInfo.url, jarPath, (downloaded, total) => {
      const downloadedMB = (downloaded / 1024 / 1024).toFixed(1);
      
      if (total > 0) {
        const downloadPercent = (downloaded / total) * 100;
        // Map server jar download to 20% - 90% range
        const overallPercent = 20 + downloadPercent * 0.7;
        const totalMB = (total / 1024 / 1024).toFixed(1);
        sendProgress({
          stage: "downloading",
          message: `Downloading ${params.framework} ${params.version}... ${Math.round(downloadPercent)}% (${downloadedMB} / ${totalMB} MB)`,
          percent: Math.round(overallPercent),
          bytesDownloaded: downloaded,
          bytesTotal: total,
        });
      } else {
        // No content-length header - estimate progress based on typical server jar size (~50MB)
        // Map server jar download to 20% - 90% range based on estimated 50MB
        const estimatedTotal = 50 * 1024 * 1024; // 50MB estimate
        const estimatedPercent = Math.min((downloaded / estimatedTotal) * 100, 99);
        const overallPercent = 20 + estimatedPercent * 0.7;
        sendProgress({
          stage: "downloading",
          message: `Downloading ${params.framework} ${params.version}... ${downloadedMB} MB`,
          percent: Math.round(overallPercent),
          bytesDownloaded: downloaded,
          bytesTotal: 0,
        });
      }
    });

    // 4. Write start.bat
    sendProgress({ stage: "writing-files", message: "Creating start.bat...", percent: 85 });
    await fs.writeFile(
      path.join(finalDir, "start.bat"),
      generateStartBat(clampRam(params.ramMB), downloadInfo.jarFile),
      "utf-8"
    );

    // 5. Create server record (EULA not yet accepted)
    // 5b. Install CatalystAnalytics plugin if requested and framework supports plugins
    const pluginCompatible = params.framework === "Paper" || params.framework === "Purpur";
    const analyticsEnabled = !!(params.enableAnalytics && pluginCompatible);
    if (analyticsEnabled) {
      sendProgress({ stage: "writing-files", message: "Installing CatalystAnalytics plugin...", percent: 90 });
      try {
        await installCatalystPlugin(finalDir);
      } catch (err) {
        console.error("Failed to install CatalystAnalytics plugin:", err);
        // Non-fatal: server still works without the plugin
      }
    }

    const serverRecord: ServerRecord = {
      id: crypto.randomUUID(),
      name: params.name,
      framework: params.framework,
      version: params.version,
      ramMB: clampRam(params.ramMB),
      status: "Offline",
      players: "0/20",
      createdAt: new Date().toISOString(),
      serverPath: finalDir,
      eulaAccepted: false,
      jarFile: downloadInfo.jarFile,
      analyticsEnabled,
    };

    // 7. Persist
    sendProgress({ stage: "writing-files", message: "Saving server configuration...", percent: 95 });
    const servers = await loadServerList();
    servers.push(serverRecord);
    await saveServerList(servers);

    sendProgress({ stage: "done", message: "Server created successfully!", percent: 100 });
    return { success: true, server: serverRecord };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
    sendProgress({ stage: "error", message: errorMessage, percent: 0 });
    return { success: false, error: errorMessage };
  }
}

export async function getServers(): Promise<ServerRecord[]> {
  return loadServerList();
}

export async function deleteServer(
  serverId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const servers = await loadServerList();
    const server = servers.find((s) => s.id === serverId);
    if (!server) {
      return { success: false, error: "Server not found" };
    }

    try {
      await fs.rm(server.serverPath, { recursive: true, force: true });
    } catch {
      // Log but don't fail if folder removal fails
    }

    const updated = servers.filter((s) => s.id !== serverId);
    await saveServerList(updated);

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}

export async function getServer(id: string): Promise<ServerRecord | null> {
  const servers = await loadServerList();
  return servers.find((s) => s.id === id) || null;
}

export async function updateServerStatus(
  id: string,
  status: "Online" | "Offline",
  players?: string
): Promise<void> {
  const servers = await loadServerList();
  const server = servers.find((s) => s.id === id);
  if (server) {
    server.status = status;
    if (players !== undefined) server.players = players;
    await saveServerList(servers);
  }
}

export async function getServerProperties(
  serverPath: string
): Promise<ServerProperty[]> {
  const propsPath = path.join(serverPath, "server.properties");
  try {
    const content = await fs.readFile(propsPath, "utf-8");
    const lines = content.split(/\r?\n/);
    const properties: ServerProperty[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("#")) {
        properties.push({ key: "", value: "", comment: trimmed });
        continue;
      }
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      properties.push({
        key: trimmed.substring(0, eqIndex),
        value: trimmed.substring(eqIndex + 1),
      });
    }
    return properties;
  } catch {
    return [];
  }
}

export async function saveServerProperties(
  serverPath: string,
  properties: ServerProperty[]
): Promise<{ success: boolean; error?: string }> {
  const propsPath = path.join(serverPath, "server.properties");
  try {
    const lines: string[] = [];
    for (const prop of properties) {
      if (prop.comment) {
        lines.push(prop.comment);
      } else {
        lines.push(`${prop.key}=${prop.value}`);
      }
    }
    await fs.writeFile(propsPath, lines.join("\n") + "\n", "utf-8");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

export async function getWhitelist(serverPath: string): Promise<string[]> {
  const whitelistPath = path.join(serverPath, "whitelist.json");
  try {
    const content = await fs.readFile(whitelistPath, "utf-8");
    const data = JSON.parse(content) as Array<{ name: string }>;
    return data.map((entry) => entry.name);
  } catch {
    return [];
  }
}

export async function saveWhitelist(
  serverPath: string,
  players: string[]
): Promise<{ success: boolean; error?: string }> {
  const whitelistPath = path.join(serverPath, "whitelist.json");
  try {
    const data = players.map((name) => ({ uuid: "", name }));
    await fs.writeFile(whitelistPath, JSON.stringify(data, null, 2), "utf-8");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

export async function getBanlist(serverPath: string): Promise<string[]> {
  const banPath = path.join(serverPath, "banned-players.json");
  try {
    const content = await fs.readFile(banPath, "utf-8");
    const data = JSON.parse(content) as Array<{ name: string }>;
    return data.map((entry) => entry.name);
  } catch {
    return [];
  }
}

export async function saveBanlist(
  serverPath: string,
  players: string[]
): Promise<{ success: boolean; error?: string }> {
  const banPath = path.join(serverPath, "banned-players.json");
  try {
    const data = players.map((name) => ({
      uuid: "",
      name,
      created: new Date().toISOString(),
      source: "Catalyst",
      expires: "forever",
      reason: "Banned by operator",
    }));
    await fs.writeFile(banPath, JSON.stringify(data, null, 2), "utf-8");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

/** Returns the maximum RAM (in MB) that should be allocated to a server. */
function getMaxRamMB(): number {
  const totalMB = Math.floor(os.totalmem() / (1024 * 1024));
  const eightyPercent = Math.floor(totalMB * 0.8);
  const totalMinus1GB = totalMB - 1024;
  return Math.max(512, Math.min(eightyPercent, totalMinus1GB));
}

/** Clamp a RAM value to the safe system maximum. */
function clampRam(ramMB: number): number {
  return Math.max(512, Math.min(ramMB, getMaxRamMB()));
}

export function getSystemInfo(): { totalMemoryMB: number; maxRamMB: number } {
  const totalMemoryMB = Math.floor(os.totalmem() / (1024 * 1024));
  return { totalMemoryMB, maxRamMB: getMaxRamMB() };
}

export async function updateServerSettings(
  id: string,
  settings: { ramMB?: number; javaPath?: string; backupConfig?: ServerRecord['backupConfig']; useNgrok?: boolean; ngrokUrl?: string; name?: string; analyticsEnabled?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    const servers = await loadServerList();
    const server = servers.find((s) => s.id === id);
    if (!server) {
      return { success: false, error: "Server not found" };
    }

    if (settings.ramMB !== undefined) {
      const safeRam = clampRam(settings.ramMB);
      server.ramMB = safeRam;
      // Update start.bat with new RAM
      const batPath = path.join(server.serverPath, "start.bat");
      await fs.writeFile(batPath, generateStartBat(safeRam, server.jarFile || "server.jar"), "utf-8");
    }

    if (settings.javaPath !== undefined) {
      server.javaPath = settings.javaPath;
    }

    if (settings.backupConfig !== undefined) {
      server.backupConfig = settings.backupConfig;
    }

    if (settings.useNgrok !== undefined) {
      server.useNgrok = settings.useNgrok;
    }

    if (settings.ngrokUrl !== undefined) {
      server.ngrokUrl = settings.ngrokUrl;
    }

    if (settings.name !== undefined) {
      server.name = settings.name;
    }

    if (settings.analyticsEnabled !== undefined) {
      server.analyticsEnabled = settings.analyticsEnabled;
      if (settings.analyticsEnabled) {
        await installCatalystPlugin(server.serverPath);
      } else {
        await uninstallCatalystPlugin(server.serverPath);
      }
    }

    await saveServerList(servers);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

export async function acceptEula(
  serverId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const servers = await loadServerList();
    const server = servers.find((s) => s.id === serverId);
    if (!server) return { success: false, error: "Server not found" };

    await fs.writeFile(
      path.join(server.serverPath, "eula.txt"),
      "eula=true\r\n",
      "utf-8"
    );

    server.eulaAccepted = true;
    await saveServerList(servers);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

export async function listServerFiles(
  serverId: string,
  relativePath: string
): Promise<FileEntry[]> {
  const servers = await loadServerList();
  const server = servers.find((s) => s.id === serverId);
  if (!server) return [];

  const serverRoot = path.resolve(server.serverPath);
  const targetPath = path.resolve(serverRoot, relativePath);

  // Security: prevent path traversal
  if (!isPathWithin(targetPath, serverRoot)) {
    return [];
  }

  try {
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    const result: FileEntry[] = [];
    for (const entry of entries) {
      const fullPath = path.join(targetPath, entry.name);
      try {
        const stat = await fs.stat(fullPath);
        result.push({
          name: entry.name,
          isDirectory: entry.isDirectory(),
          size: entry.isDirectory() ? 0 : stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      } catch {
        // Skip entries we cannot stat
      }
    }
    // Sort: directories first, then alphabetical
    result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return result;
  } catch {
    return [];
  }
}

const MAX_FILE_READ_SIZE = 2 * 1024 * 1024; // 2 MB max for editor

export async function readServerFile(
  serverId: string,
  relativePath: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  const servers = await loadServerList();
  const server = servers.find((s) => s.id === serverId);
  if (!server) return { success: false, error: "Server not found" };

  const serverRoot = path.resolve(server.serverPath);
  const targetPath = path.resolve(serverRoot, relativePath);

  if (!isPathWithin(targetPath, serverRoot)) {
    return { success: false, error: "Access denied" };
  }

  try {
    const stat = await fs.stat(targetPath);
    if (stat.isDirectory()) {
      return { success: false, error: "Cannot read a directory" };
    }
    if (stat.size > MAX_FILE_READ_SIZE) {
      return { success: false, error: "File too large to edit (> 2 MB)" };
    }
    const content = await fs.readFile(targetPath, "utf-8");
    return { success: true, content };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

export async function writeServerFile(
  serverId: string,
  relativePath: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  const servers = await loadServerList();
  const server = servers.find((s) => s.id === serverId);
  if (!server) return { success: false, error: "Server not found" };

  const serverRoot = path.resolve(server.serverPath);
  const targetPath = path.resolve(serverRoot, relativePath);

  if (!isPathWithin(targetPath, serverRoot)) {
      return { success: false, error: "Access denied" };
  }

  try {
    await fs.writeFile(targetPath, content, "utf-8");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

export async function deleteServerFile(
    serverId: string,
    relativePath: string
): Promise<{ success: boolean; error?: string }> {
    const servers = await loadServerList();
    const server = servers.find((s) => s.id === serverId);
    if (!server) return { success: false, error: "Server not found" };

    const serverRoot = path.resolve(server.serverPath);
    const targetPath = path.resolve(serverRoot, relativePath);
  
    if (!isPathWithin(targetPath, serverRoot)) {
      return { success: false, error: "Access denied" };
    }

    try {
        await fs.rm(targetPath, { recursive: true, force: true });
        return { success: true };
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return { success: false, error: msg };
    }
}

export async function renameServerFile(
    serverId: string,
    relativePath: string,
    newName: string
): Promise<{ success: boolean; error?: string }> {
    const servers = await loadServerList();
    const server = servers.find((s) => s.id === serverId);
    if (!server) return { success: false, error: "Server not found" };

    // Validate newName doesn't contain path separators or traversal
    if (!newName || newName.includes('/') || newName.includes('\\') || newName.includes('..') || newName.includes('\0')) {
        return { success: false, error: "Invalid file name" };
    }

    const serverRoot = path.resolve(server.serverPath);
    const oldPath = path.resolve(serverRoot, relativePath);
    
    // Calculate new path based on the directory of the old path
    const dir = path.dirname(oldPath);
    const newPath = path.join(dir, newName);

    if (!isPathWithin(oldPath, serverRoot) || !isPathWithin(newPath, serverRoot)) {
        return { success: false, error: "Access denied" };
    }

    try {
        await fs.rename(oldPath, newPath);
        return { success: true };
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return { success: false, error: msg };
    }
}

export async function copyServerFile(
    serverId: string,
    relativePath: string,
    newName: string
): Promise<{ success: boolean; error?: string }> {
    const servers = await loadServerList();
    const server = servers.find((s) => s.id === serverId);
    if (!server) return { success: false, error: "Server not found" };

    // Validate newName doesn't contain path separators or traversal
    if (!newName || newName.includes('/') || newName.includes('\\') || newName.includes('..') || newName.includes('\0')) {
        return { success: false, error: "Invalid file name" };
    }

    const serverRoot = path.resolve(server.serverPath);
    const sourcePath = path.resolve(serverRoot, relativePath);
    
    // Calculate new path based on the directory of the old path
    const dir = path.dirname(sourcePath);
    const destPath = path.join(dir, newName);

    if (!isPathWithin(sourcePath, serverRoot) || !isPathWithin(destPath, serverRoot)) {
        return { success: false, error: "Access denied" };
    }

    try {
        // Recursive copy if it's a folder? cp is strictly experimental in Node 16.
        // But many servers run newer Node. Electron typically runs newer Node.
        // fs.cp is available since Node 16.7.0.
        // Let's assume it works or use copyFile for files.
        const stat = await fs.stat(sourcePath);
        if (stat.isDirectory()) {
             await fs.cp(sourcePath, destPath, { recursive: true });
        } else {
             await fs.copyFile(sourcePath, destPath);
        }
        return { success: true };
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return { success: false, error: msg };
    }
}

// ---- Server Export/Import ----

interface ServerManifest {
  version: string;
  exportedAt: string;
  server: {
    name: string;
    platform: string;
    mcVersion: string;
    ramMB: number;
    jarFile?: string;
  };
}

export async function exportServer(
  serverId: string,
  mainWindow: BrowserWindow
): Promise<{ success: boolean; error?: string; path?: string }> {
  const server = await getServer(serverId);
  if (!server) {
    return { success: false, error: "Server not found" };
  }

  // Show save dialog
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export Server",
    defaultPath: `${server.name}-export.zip`,
    filters: [{ name: "Zip Archive", extensions: ["zip"] }],
  });

  if (result.canceled || !result.filePath) {
    return { success: false, error: "Export cancelled" };
  }

  const outputPath = result.filePath;

  return new Promise((resolve) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      resolve({ success: true, path: outputPath });
    });

    archive.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });

    archive.pipe(output);

    // Add manifest
    const manifest: ServerManifest = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      server: {
        name: server.name,
        platform: server.framework,
        mcVersion: server.version,
        ramMB: server.ramMB,
        jarFile: server.jarFile,
      },
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });

    // Add entire server directory
    archive.directory(server.serverPath, false, (entry) => {
      // Skip large unnecessary files like logs
      if (entry.name.startsWith("logs/")) {
        return false;
      }
      return entry;
    });

    archive.finalize();
  });
}

export async function importServer(
  zipPath: string,
  customName: string,
  _mainWindow: BrowserWindow
): Promise<{ success: boolean; error?: string; server?: ServerRecord }> {
  try {
    // Read the zip file
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();

    // Find and read manifest
    const manifestEntry = zipEntries.find((e) => e.entryName === "manifest.json");
    if (!manifestEntry) {
      return { success: false, error: "Invalid export file: missing manifest.json" };
    }

    const manifestData = manifestEntry.getData().toString("utf8");
    const manifest: ServerManifest = JSON.parse(manifestData);

    // Generate new server ID
    const serverId = crypto.randomUUID();
    const serverPath = path.join(SERVERS_DIR, serverId);

    // Create server directory
    await fs.mkdir(serverPath, { recursive: true });

    // Extract all files except manifest (with zip slip protection)
    const resolvedServerPath = path.resolve(serverPath);
    for (const entry of zipEntries) {
      if (entry.entryName === "manifest.json") continue;
      if (entry.isDirectory) continue;

      const outputPath = path.resolve(serverPath, entry.entryName);

      // Zip slip protection: ensure extracted path is within server directory
      if (!isPathWithin(outputPath, resolvedServerPath)) {
        console.warn(`[IMPORT] Skipping malicious zip entry: ${entry.entryName}`);
        continue;
      }

      const outputDir = path.dirname(outputPath);

      // Create directory if needed
      await fs.mkdir(outputDir, { recursive: true });

      // Write file
      const data = entry.getData();
      await fs.writeFile(outputPath, data);
    }

    // Create server record
    const newServer: ServerRecord = {
      id: serverId,
      name: customName || manifest.server.name,
      version: manifest.server.mcVersion,
      framework: manifest.server.platform,
      serverPath,
      ramMB: manifest.server.ramMB,
      status: "Offline",
      players: "0/20",
      createdAt: new Date().toISOString(),
      jarFile: manifest.server.jarFile || "server.jar",
    };

    // Add to servers list
    const servers = await loadServerList();
    servers.push(newServer);
    await saveServerList(servers);

    return { success: true, server: newServer };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

/**
 * Calculate the size of a directory recursively
 */
async function calculateFolderSize(dirPath: string): Promise<number> {
  let totalSize = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += await calculateFolderSize(entryPath);
      } else if (entry.isFile()) {
        const stats = await fs.stat(entryPath);
        totalSize += stats.size;
      }
    }
  } catch {
    // Ignore errors (permission issues, etc.)
  }
  return totalSize;
}

/**
 * Get disk usage for a server
 */
export async function getServerDiskUsage(
  serverId: string
): Promise<{ success: boolean; bytes?: number; error?: string }> {
  try {
    const server = await getServer(serverId);
    if (!server) {
      return { success: false, error: "Server not found" };
    }

    const bytes = await calculateFolderSize(server.serverPath);
    return { success: true, bytes };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}
