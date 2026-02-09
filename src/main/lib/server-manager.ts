import { app, BrowserWindow } from "electron";
import path from "path";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import https from "https";
import http from "http";
import crypto from "crypto";
import {
  CreateServerParams,
  CreateServerResult,
  FileEntry,
  ServerCreationProgress,
  ServerProperty,
  ServerRecord,
} from "@shared/types";
import { getRequiredJavaVersion, ensureJavaInstalled } from "./java-manager";

const SERVERS_DIR = path.join(app.getPath("userData"), "servers");
const SERVERS_JSON = path.join(app.getPath("userData"), "servers.json");

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
  return resolved.startsWith(serversResolved + path.sep);
}

async function loadServerList(): Promise<ServerRecord[]> {
  try {
    const data = await fs.readFile(SERVERS_JSON, "utf-8");
    return JSON.parse(data) as ServerRecord[];
  } catch {
    return [];
  }
}

async function saveServerList(servers: ServerRecord[]): Promise<void> {
  await fs.writeFile(SERVERS_JSON, JSON.stringify(servers, null, 2), "utf-8");
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
  return `@echo off\r\njava -Xms${ramMB}M -Xmx${ramMB}M -XX:+AlwaysPreTouch -XX:+DisableExplicitGC -XX:+ParallelRefProcEnabled -XX:+PerfDisableSharedMem -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1HeapRegionSize=8M -XX:G1HeapWastePercent=5 -XX:G1MaxNewSizePercent=40 -XX:G1MixedGCCountTarget=4 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1NewSizePercent=30 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:G1ReservePercent=20 -XX:InitiatingHeapOccupancyPercent=15 -XX:MaxGCPauseMillis=200 -XX:MaxTenuringThreshold=1 -XX:SurvivorRatio=32 -Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true -jar ${jarFile} nogui\r\npause\r\n`;
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
      generateStartBat(params.ramMB, downloadInfo.jarFile),
      "utf-8"
    );

    // 5. Create server record (EULA not yet accepted)
    const serverRecord: ServerRecord = {
      id: crypto.randomUUID(),
      name: params.name,
      framework: params.framework,
      version: params.version,
      ramMB: params.ramMB,
      status: "Offline",
      players: "0/20",
      createdAt: new Date().toISOString(),
      serverPath: finalDir,
      eulaAccepted: false,
      jarFile: downloadInfo.jarFile,
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

export async function updateServerSettings(
  id: string,
  settings: { ramMB?: number; javaPath?: string; backupConfig?: ServerRecord['backupConfig']; useNgrok?: boolean; ngrokUrl?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const servers = await loadServerList();
    const server = servers.find((s) => s.id === id);
    if (!server) {
      return { success: false, error: "Server not found" };
    }

    if (settings.ramMB !== undefined) {
      server.ramMB = settings.ramMB;
      // Update start.bat with new RAM
      const batPath = path.join(server.serverPath, "start.bat");
      await fs.writeFile(batPath, generateStartBat(settings.ramMB, server.jarFile || "server.jar"), "utf-8");
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
  if (!targetPath.startsWith(serverRoot)) {
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

  if (!targetPath.startsWith(serverRoot)) {
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

  if (!targetPath.startsWith(serverRoot)) {
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

    if (!targetPath.startsWith(serverRoot)) {
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

    const serverRoot = path.resolve(server.serverPath);
    const oldPath = path.resolve(serverRoot, relativePath);
    
    // Calculate new path based on the directory of the old path
    const dir = path.dirname(oldPath);
    const newPath = path.join(dir, newName);

    if (!oldPath.startsWith(serverRoot) || !newPath.startsWith(serverRoot)) {
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

    const serverRoot = path.resolve(server.serverPath);
    const sourcePath = path.resolve(serverRoot, relativePath);
    
    // Calculate new path based on the directory of the old path
    const dir = path.dirname(sourcePath);
    const destPath = path.join(dir, newName);

    if (!sourcePath.startsWith(serverRoot) || !destPath.startsWith(serverRoot)) {
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
