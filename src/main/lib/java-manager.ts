import { app } from "electron";
import path from "path";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import { spawn } from "child_process";
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

  // Only handle MC 1.x logic
  if (major !== 1) return 8;

  // 1.20+ -> Java 21 ("Compatible with 1.20 and above", "newest optimizations")
  if (minor >= 20) return 21;
  
  // 1.17 - 1.19 -> Java 17 ("Officially recommended", "Best option for 1.17")
  if (minor >= 17) return 17;
  
  // 1.12 - 1.16.5 -> Java 11 ("Java 11 also works well", "improve performance")
  if (minor >= 12) return 11;
  
  // 1.7.10 - 1.11.2 -> Java 8 ("Recommended Java: Java 8")
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
 * Downloads a file from a URL with timeout and stall detection.
 * - Overall download timeout of 10 minutes
 * - Stall detection: aborts if no data received for 30 seconds
 * - Follows redirects
 */
async function downloadFile(url: string, destPath: string, onProgress?: (downloaded: number, total: number) => void): Promise<void> {
  // Use a unique temp path to avoid locking issues during download
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

    // Overall download timeout
    const overallTimer = setTimeout(() => {
      settle(() => {
        console.error(`[java-manager] Download timed out after ${DOWNLOAD_TIMEOUT_MS / 1000}s for ${url}`);
        request.destroy();
        file.close();
        fs.unlink(tempPath).catch(() => {});
        reject(new Error(`Download timed out after ${DOWNLOAD_TIMEOUT_MS / 1000} seconds`));
      });
    }, DOWNLOAD_TIMEOUT_MS);

    // Stall detection timer — reset on each data chunk
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    const resetStallTimer = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        settle(() => {
          console.error(`[java-manager] Download stalled (no data for ${DOWNLOAD_STALL_TIMEOUT_MS / 1000}s)`);
          request.destroy();
          file.close();
          fs.unlink(tempPath).catch(() => {});
          reject(new Error(`Download stalled — no data received for ${DOWNLOAD_STALL_TIMEOUT_MS / 1000} seconds`));
        });
      }, DOWNLOAD_STALL_TIMEOUT_MS);
    };

    const cleanupTimers = () => {
      clearTimeout(overallTimer);
      if (stallTimer) clearTimeout(stallTimer);
    };

    const request = https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        cleanupTimers();
        file.close();
        fs.unlink(tempPath).catch(() => {});
        downloadFile(response.headers.location, destPath, onProgress).then(resolve).catch(reject);
        return;
      }

      // Handle HTTP errors
      if (response.statusCode && (response.statusCode < 200 || response.statusCode >= 300)) {
        cleanupTimers();
        file.close();
        fs.unlink(tempPath).catch(() => {});
        settle(() => reject(new Error(`HTTP ${response.statusCode} downloading ${url}`)));
        return;
      }
      
      const totalBytes = parseInt(response.headers['content-length'] || "0", 10);
      let downloadedBytes = 0;

      // Start stall detection
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
            // Move to final destination safely
            try {
                // Try to remove destination if it exists
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

/**
 * Extracts an archive to the destination directory.
 * - Windows (.zip): Uses adm-zip for reliable, synchronous extraction (no PowerShell dependency)
 * - Linux/macOS (.tar.gz): Uses tar with timeout and stderr capture
 */
function extractArchive(archivePath: string, destDir: string): Promise<void> {
  if (process.platform === "win32") {
    // Use adm-zip for Windows .zip extraction — much more reliable than PowerShell Expand-Archive
    // which can hang or fail silently with encoded commands
    return new Promise((resolve, reject) => {
      try {
        console.log(`[java-manager] Extracting ${archivePath} to ${destDir} using adm-zip`);
        const zip = new AdmZip(archivePath);
        zip.extractAllTo(destDir, true); // true = overwrite existing files
        console.log(`[java-manager] Extraction complete`);
        resolve();
      } catch (err) {
        reject(new Error(`ZIP extraction failed: ${err instanceof Error ? err.message : String(err)}`));
      }
    });
  }

  // Unix (tar) - use -xzf for .tar.gz archives with proper error handling and timeout
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };

    console.log(`[java-manager] Extracting ${archivePath} to ${destDir} using tar`);
    const proc = spawn("tar", ["-xzf", archivePath, "-C", destDir]);

    // Capture stderr for error diagnostics
    let stderrOutput = "";
    if (proc.stderr) {
      proc.stderr.on("data", (data) => {
        stderrOutput += data.toString();
      });
    }

    // Timeout: kill tar if it takes too long
    const timer = setTimeout(() => {
      console.error(`[java-manager] tar extraction timed out after ${EXTRACTION_TIMEOUT_MS / 1000}s`);
      proc.kill("SIGKILL");
      settle(() => reject(new Error(`Extraction timed out after ${EXTRACTION_TIMEOUT_MS / 1000} seconds`)));
    }, EXTRACTION_TIMEOUT_MS);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        console.log(`[java-manager] tar extraction complete`);
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

/**
 * Find the JDK home directory (the directory containing bin/, lib/, etc.)
 * by looking for the bin/ directory with the java executable.
 */
async function findJdkHome(dir: string): Promise<string | null> {
  const executableName = process.platform === "win32" ? "java.exe" : "java";
  try {
    const binDir = path.join(dir, "bin");
    const candidate = path.join(binDir, executableName);
    try {
      await fs.access(candidate);
      return dir; // This directory IS the JDK home
    } catch {}

    // Check subdirectories (Adoptium extracts into a nested folder like jdk-21.0.10+7)
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
 * Downloads and sets up the required Java runtime.
 * Returns the path to the java executable.
 * Sets JAVA_HOME-relative paths correctly so jvm.cfg can be found.
 *
 * Improvements:
 * - Full try/catch with meaningful error messages and cleanup of partial files
 * - Validates downloaded archive size before extraction
 * - Logs progress at each stage for debugging
 *
 * @param version Java version (e.g. 8, 11, 17)
 * @param onProgress Callback used to report download/extraction progress
 */
export async function ensureJavaInstalled(
    version: number,
    onProgress?: (stage: 'downloading' | 'extracting', percent: number, downloaded?: number, total?: number) => void
): Promise<string> {
  const runtimeName = `java-${version}`;
  const runtimePath = path.join(RUNTIMES_DIR, runtimeName);
  const executableName = process.platform === "win32" ? "java.exe" : "java";

  // Adoptium delivers .zip on Windows, .tar.gz on Linux/macOS
  const archiveExt = process.platform === "win32" ? ".zip" : ".tar.gz";
  const archiveName = `java-${version}${archiveExt}`;
  const archivePath = path.join(RUNTIMES_DIR, archiveName);

  try {
    // Ensure runtimes directory exists
    console.log(`[java-manager] Ensuring runtimes directory exists: ${RUNTIMES_DIR}`);
    await fs.mkdir(RUNTIMES_DIR, { recursive: true });

    // Check if existing installation is valid
    try {
      const jdkHome = await findJdkHome(runtimePath);
      if (jdkHome) {
        const existingBin = path.join(jdkHome, "bin", executableName);
        await fs.access(existingBin);
        console.log(`[java-manager] Java ${version} already installed at ${existingBin}`);
        if (onProgress) onProgress('downloading', 100);
        return existingBin;
      }
    } catch {
      // Not installed or invalid — proceed with download
    }

    // Download Java
    console.log(`[java-manager] Downloading Java ${version}...`);
    if (onProgress) onProgress('downloading', 0, 0, 0);
    
    const platform = getPlatformString();
    const arch = getArchString();
    const url = `https://api.adoptium.net/v3/binary/latest/${version}/ga/${platform}/${arch}/jdk/hotspot/normal/eclipse`;

    console.log(`[java-manager] Download URL: ${url}`);
    console.log(`[java-manager] Archive path: ${archivePath}`);

    await downloadFile(url, archivePath, (downloaded, total) => {
      let percent = 0;
      if (total > 0) percent = (downloaded / total) * 100;
      if (onProgress) onProgress('downloading', percent, downloaded, total);
    });

    // Validate that the archive was actually downloaded and has content
    const archiveStat = await fs.stat(archivePath);
    if (archiveStat.size === 0) {
      await fs.unlink(archivePath).catch(() => {});
      throw new Error(`Downloaded archive is empty (0 bytes). Download may have failed silently.`);
    }
    console.log(`[java-manager] Download complete: ${archiveStat.size} bytes`);

    // Extract
    console.log(`[java-manager] Extracting Java ${version}...`);
    if (onProgress) onProgress('extracting', 0);
    
    // Remove old runtime directory if it exists (clean install)
    try { await fs.rm(runtimePath, { recursive: true, force: true }); } catch {}
    await fs.mkdir(runtimePath, { recursive: true });
    
    await extractArchive(archivePath, runtimePath);
    
    // Clean up archive after successful extraction
    console.log(`[java-manager] Cleaning up archive: ${archivePath}`);
    await fs.unlink(archivePath).catch(() => {});

    // Find the JDK home (handles nested directory from extraction)
    const jdkHome = await findJdkHome(runtimePath);
    if (!jdkHome) throw new Error(`Java ${version} installed but JDK home not found in ${runtimePath}`);

    const bin = path.join(jdkHome, "bin", executableName);
    try {
      await fs.access(bin);
    } catch {
      throw new Error(`Java ${version} installed but binary not found at ${bin}`);
    }
    
    // Verify lib/jvm.cfg exists (critical for Java to start)
    const jvmCfg = path.join(jdkHome, "lib", "jvm.cfg");
    try {
      await fs.access(jvmCfg);
    } catch {
      throw new Error(`Java ${version} extraction incomplete: lib/jvm.cfg not found at ${jvmCfg}`);
    }
    
    // Set executable permissions on Unix
    if (process.platform !== "win32") {
      await fs.chmod(bin, 0o755);
    }

    console.log(`[java-manager] Java ${version} ready at ${bin}`);
    if (onProgress) onProgress('extracting', 100);
    return bin;

  } catch (err) {
    // Clean up partial files on failure
    console.error(`[java-manager] Failed to install Java ${version}:`, err);

    // Remove partial archive if it exists
    await fs.unlink(archivePath).catch(() => {});
    // Remove partial runtime directory if it exists
    await fs.rm(runtimePath, { recursive: true, force: true }).catch(() => {});

    throw new Error(
      `Failed to install Java ${version}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Derives JAVA_HOME from a java binary path.
 * e.g. /path/to/jdk-21/bin/java -> /path/to/jdk-21
 */
export function getJavaHome(javaBinaryPath: string): string {
  // java binary is at <JAVA_HOME>/bin/java
  return path.dirname(path.dirname(javaBinaryPath));
}
