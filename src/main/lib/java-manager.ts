import { app } from "electron";
import path from "path";
import fs from "fs/promises";
import { createWriteStream, existsSync } from "fs";
import { spawn, execSync, exec } from "child_process";
import https from "https";
import AdmZip from "adm-zip";

const RUNTIMES_DIR = path.join(app.getPath("userData"), "runtimes");

/** Download timeout: 10 minutes max for the entire download */
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;
/** Stall timeout: abort if no data received for 30 seconds */
const DOWNLOAD_STALL_TIMEOUT_MS = 30 * 1000;
/** Extraction timeout for tar: 5 minutes */
const EXTRACTION_TIMEOUT_MS = 5 * 60 * 1000;

// Map Minecraft versions to Java versions
export function getRequiredJavaVersion(mcVersion: string): number {
  // Normalize version (remove snapshots/pre-releases for comparison)
  const match = mcVersion.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return 8; // Fallback

  const major = parseInt(match[1]);
  const minor = parseInt(match[2]);

  // Calendar-versioned Java Edition releases (26.1+) keep the modern Java baseline.
  if (major >= 26) return 21;

  // Only handle legacy MC 1.x logic after calendar versions.
  if (major !== 1) return 8;

  // 1.20.5+ -> Java 21
  if (minor > 20 || (minor === 20 && parseInt(match[3] || "0") >= 5)) return 21;

  // 1.17 - 1.20.4 -> Java 17
  if (minor >= 17) return 17;
  
  // 1.12 - 1.16.5 -> Java 11
  if (minor >= 12) return 11;
  
  // 1.7.10 - 1.11.2 -> Java 8
  return 8;
}

function getPlatformString(): string {
  switch (process.platform) {
    case "win32": return "windows";
    case "darwin": return "mac";
    case "linux": return "linux";
    default: return "windows";
  }
}

function getArchString(): string {
  const arch = process.arch;
  if (arch === "x64") return "x64";
  if (arch === "arm64") return "aarch64";
  return "x64"; // Fallback
}

/**
 * Tests if a Java executable works and returns its major version.
 */
export async function getJavaVersion(javaPath: string): Promise<number | null> {
  return new Promise((resolve) => {
    // Wrap path in quotes to handle spaces
    const cmd = process.platform === "win32" ? `"${javaPath}" -version` : `"${javaPath}" -version`;
    exec(cmd, (error, _stdout, stderr) => {
      if (error) {
        // Fallback for some environments
        exec(`${javaPath} -version`, (error2, _stdout2, stderr2) => {
          if (error2) return resolve(null);
          const versionStr = stderr2.split("\n")[0];
          resolve(parseJavaVersion(versionStr));
        });
        return;
      }
      const versionStr = stderr.split("\n")[0];
      resolve(parseJavaVersion(versionStr));
    });
  });
}

function parseJavaVersion(versionStr: string): number | null {
  // openjdk version "21.0.2" ...
  // java version "1.8.0_202"
  const match = versionStr.match(/version "(\d+)/);
  if (match) {
    let v = parseInt(match[1]);
    if (v === 1) {
      const secondaryMatch = versionStr.match(/version "1\.(\d+)/);
      if (secondaryMatch) v = parseInt(secondaryMatch[1]);
    }
    return v;
  }
  return null;
}

/**
 * Scan common installation paths for Java runtimes.
 */
export async function discoverInstalledJavas(): Promise<Array<{ path: string; version: number }>> {
  const found: Array<{ path: string; version: number }> = [];
  const searchPaths = new Set<string>();

  // 1. Check JAVA_HOME
  if (process.env.JAVA_HOME) {
    searchPaths.add(path.join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java"));
  }

  // 2. Check system PATH
  try {
    const whichCmd = process.platform === "win32" ? "where java" : "which java";
    const pathOutput = execSync(whichCmd).toString().trim().split(/\r?\n/);
    for (const p of pathOutput) {
        if (p) searchPaths.add(p);
    }
  } catch {}

  // 3. Platform specific common paths
  const platformPaths: string[] = [];
  if (process.platform === "win32") {
    const programFiles = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean) as string[];
    const localApps = process.env.LOCALAPPDATA;
    
    for (const pf of programFiles) {
        platformPaths.push(path.join(pf, "Java"));
        platformPaths.push(path.join(pf, "Eclipse Foundation"));
        platformPaths.push(path.join(pf, "AdoptOpenJDK"));
        platformPaths.push(path.join(pf, "Amazon Corretto"));
        platformPaths.push(path.join(pf, "BellSoft"));
        platformPaths.push(path.join(pf, "Zulu"));
    }
    if (localApps) {
        platformPaths.push(path.join(localApps, "Programs", "Eclipse Foundation"));
    }
  } else if (process.platform === "darwin") {
    platformPaths.push("/Library/Java/JavaVirtualMachines");
    platformPaths.push("/System/Library/Java/JavaVirtualMachines");
  } else if (process.platform === "linux") {
    platformPaths.push("/usr/lib/jvm");
    platformPaths.push("/usr/java");
  }

  const discoveredBins = new Set<string>();
  for (const basePath of platformPaths) {
    try {
      if (existsSync(basePath)) {
        await findJavaBinaries(basePath, discoveredBins, 0);
      }
    } catch {}
  }

  const allPossiblePaths = new Set([...searchPaths, ...discoveredBins]);

  for (const javaPath of allPossiblePaths) {
    const version = await getJavaVersion(javaPath);
    if (version) {
      found.push({ path: javaPath, version });
    }
  }

  // Add catalyst-managed runtimes
  if (existsSync(RUNTIMES_DIR)) {
    try {
        const runtimes = await fs.readdir(RUNTIMES_DIR);
        for (const r of runtimes) {
            const rPath = path.join(RUNTIMES_DIR, r);
            const jdkHome = await findJdkHome(rPath);
            if (jdkHome) {
                const bin = path.join(jdkHome, "bin", process.platform === "win32" ? "java.exe" : "java");
                const version = await getJavaVersion(bin);
                if (version) found.push({ path: bin, version });
            }
        }
    } catch {}
  }

  // De-duplicate by path
  const unique = Array.from(new Map(found.map(j => [j.path, j])).values());
  return unique.sort((a, b) => b.version - a.version);
}

async function findJavaBinaries(dir: string, found: Set<string>, depth: number) {
  if (depth > 4) return;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await findJavaBinaries(fullPath, found, depth + 1);
      } else if (entry.isFile() && (entry.name === "java" || entry.name === "java.exe")) {
        // Only consider if in a bin directory or similar
        if (fullPath.toLowerCase().includes("bin")) {
            found.add(fullPath);
        }
      }
    }
  } catch {}
}

/**
 * Downloads a file from a URL with timeout and stall detection.
 */
async function downloadFile(url: string, destPath: string, onProgress?: (downloaded: number, total: number) => void): Promise<void> {
  const tempPath = `${destPath}.${Date.now()}.tmp`;

  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };

    const file = createWriteStream(tempPath);

    const overallTimer = setTimeout(() => {
      settle(() => {
        request.destroy();
        file.close();
        fs.unlink(tempPath).catch(() => {});
        reject(new Error(`Download timed out after ${DOWNLOAD_TIMEOUT_MS / 1000} seconds`));
      });
    }, DOWNLOAD_TIMEOUT_MS);

    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    const resetStallTimer = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        settle(() => {
          request.destroy();
          file.close();
          fs.unlink(tempPath).catch(() => {});
          reject(new Error(`Download stalled \u2014 no data received for ${DOWNLOAD_STALL_TIMEOUT_MS / 1000} seconds`));
        });
      }, DOWNLOAD_STALL_TIMEOUT_MS);
    };

    const cleanupTimers = () => {
      clearTimeout(overallTimer);
      if (stallTimer) clearTimeout(stallTimer);
    };

    const request = https.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        cleanupTimers();
        file.close();
        fs.unlink(tempPath).catch(() => {});
        downloadFile(response.headers.location, destPath, onProgress).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode && (response.statusCode < 200 || response.statusCode >= 300)) {
        cleanupTimers();
        file.close();
        fs.unlink(tempPath).catch(() => {});
        settle(() => reject(new Error(`HTTP ${response.statusCode} downloading ${url}`)));
        return;
      }
      
      const totalBytes = parseInt(response.headers['content-length'] || "0", 10);
      let downloadedBytes = 0;

      resetStallTimer();

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        resetStallTimer();
        if (onProgress) onProgress(downloadedBytes, totalBytes);
      });

      response.pipe(file);
      file.on("finish", () => {
        cleanupTimers();
        file.close(async (err) => {
            if (err) {
                await fs.unlink(tempPath).catch(() => {});
                settle(() => reject(err));
                return;
            }
            try {
                try { await fs.rm(destPath, { force: true }); } catch {}
                await fs.rename(tempPath, destPath);
                settle(() => resolve());
            } catch (moveErr) {
                await fs.unlink(tempPath).catch(() => {});
                settle(() => reject(moveErr));
            }
        });
      });
    });

    request.on("error", (err) => {
      cleanupTimers();
      file.close();
      fs.unlink(tempPath).catch(() => {});
      settle(() => reject(new Error(`Download failed: ${err.message}`)));
    });
  });
}

function extractArchive(archivePath: string, destDir: string): Promise<void> {
  if (process.platform === "win32") {
    return new Promise((resolve, reject) => {
      try {
        const zip = new AdmZip(archivePath);
        zip.extractAllTo(destDir, true);
        resolve();
      } catch (err) {
        reject(new Error(`ZIP extraction failed: ${err instanceof Error ? err.message : String(err)}`));
      }
    });
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };

    const proc = spawn("tar", ["-xzf", archivePath, "-C", destDir]);
    let stderrOutput = "";
    if (proc.stderr) {
      proc.stderr.on("data", (data) => {
        stderrOutput += data.toString();
      });
    }

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      settle(() => reject(new Error(`Extraction timed out after ${EXTRACTION_TIMEOUT_MS / 1000} seconds`)));
    }, EXTRACTION_TIMEOUT_MS);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        settle(() => resolve());
      } else {
        const errMsg = stderrOutput.trim() ? `: ${stderrOutput.trim()}` : "";
        settle(() => reject(new Error(`tar extraction failed with code ${code}${errMsg}`)));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      settle(() => reject(new Error(`Failed to run tar: ${err.message}`)));
    });
  });
}

async function findJdkHome(dir: string): Promise<string | null> {
  const executableName = process.platform === "win32" ? "java.exe" : "java";
  try {
    const binDir = path.join(dir, "bin");
    const candidate = path.join(binDir, executableName);
    try {
      await fs.access(candidate);
      return dir;
    } catch {}

    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const found = await findJdkHome(path.join(dir, entry.name));
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

/**
 * Downloads and sets up the required Java runtime if no suitable version is found locally.
 */
export async function ensureJavaInstalled(
    version: number,
    onProgress?: (stage: 'downloading' | 'extracting' | 'discovering', percent: number, downloaded?: number, total?: number) => void
): Promise<string> {
  // 1. Discover existing javas first
  if (onProgress) onProgress('discovering', 0);
  const installed = await discoverInstalledJavas();
  
  // Find a compatible version (exact or higher within reasonable limits)
  // For Java 8, we want 8. For 17, 17 or 21. For 21, 21.
  const bestMatch = installed.find(j => {
      if (version === 8) return j.version === 8;
      return j.version >= version;
  });

  if (bestMatch) {
    if (onProgress) onProgress('discovering', 100);
    console.log(`[java-manager] Found suitable local Java ${bestMatch.version} at ${bestMatch.path}`);
    return bestMatch.path;
  }

  // Not found, proceed with download
  const runtimeName = `java-${version}`;
  const runtimePath = path.join(RUNTIMES_DIR, runtimeName);
  const executableName = process.platform === "win32" ? "java.exe" : "java";
  const archiveExt = process.platform === "win32" ? ".zip" : ".tar.gz";
  const archiveName = `java-${version}${archiveExt}`;
  const archivePath = path.join(RUNTIMES_DIR, archiveName);

  try {
    await fs.mkdir(RUNTIMES_DIR, { recursive: true });

    // Double check managed runtimes dir specifically
    try {
        const jdkHome = await findJdkHome(runtimePath);
        if (jdkHome) {
            const bin = path.join(jdkHome, "bin", executableName);
            await fs.access(bin);
            if (onProgress) onProgress('downloading', 100);
            return bin;
        }
    } catch {}

    // Download Java
    if (onProgress) onProgress('downloading', 0, 0, 0);
    const platform = getPlatformString();
    const arch = getArchString();
    const url = `https://api.adoptium.net/v3/binary/latest/${version}/ga/${platform}/${arch}/jdk/hotspot/normal/eclipse`;

    await downloadFile(url, archivePath, (downloaded, total) => {
      let percent = 0;
      if (total > 0) percent = (downloaded / total) * 100;
      if (onProgress) onProgress('downloading', percent, downloaded, total);
    });

    // Extract
    if (onProgress) onProgress('extracting', 0);
    try { await fs.rm(runtimePath, { recursive: true, force: true }); } catch {}
    await fs.mkdir(runtimePath, { recursive: true });
    await extractArchive(archivePath, runtimePath);
    await fs.unlink(archivePath).catch(() => {});

    const jdkHome = await findJdkHome(runtimePath);
    if (!jdkHome) throw new Error(`JDK home not found after extraction`);

    const bin = path.join(jdkHome, "bin", executableName);
    await fs.access(bin);
    if (process.platform !== "win32") await fs.chmod(bin, 0o755);

    if (onProgress) onProgress('extracting', 100);
    return bin;
  } catch (err) {
    await fs.unlink(archivePath).catch(() => {});
    await fs.rm(runtimePath, { recursive: true, force: true }).catch(() => {});
    throw new Error(`Failed to install Java ${version}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function getJavaHome(javaBinaryPath: string): string {
  return path.dirname(path.dirname(javaBinaryPath));
}
