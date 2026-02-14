import { app } from "electron";
import path from "path";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import { spawn } from "child_process";
import https from "https";

const RUNTIMES_DIR = path.join(app.getPath("userData"), "runtimes");

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

async function downloadFile(url: string, destPath: string, onProgress?: (downloaded: number, total: number) => void): Promise<void> {
  // Use a unique temp path to avoid locking issues during download
  const tempPath = `${destPath}.${Date.now()}.tmp`;

  return new Promise((resolve, reject) => {
    const file = createWriteStream(tempPath);
    https.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlink(tempPath).catch(() => {});
        downloadFile(response.headers.location, destPath, onProgress).then(resolve).catch(reject);
        return;
      }
      
      const totalBytes = parseInt(response.headers['content-length'] || "0", 10);
      let downloadedBytes = 0;

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (onProgress) onProgress(downloadedBytes, totalBytes);
      });

      response.pipe(file);
      file.on("finish", () => {
        file.close(async (err) => {
            if (err) {
                await fs.unlink(tempPath).catch(() => {});
                reject(err);
                return;
            }
            // Move to final destination safely
            try {
                // Try to remove destination if it exists
                try { await fs.rm(destPath, { force: true }); } catch {}
                await fs.rename(tempPath, destPath);
                resolve();
            } catch (moveErr) {
                await fs.unlink(tempPath).catch(() => {});
                reject(moveErr);
            }
        });
      });
    }).on("error", (err) => {
      file.close();
      fs.unlink(tempPath).catch(() => {});
      reject(err);
    });
  });
}

function extractArchive(archivePath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let proc: ReturnType<typeof spawn>;

    // Determine extraction command based on OS
    if (process.platform === "win32") {
        // Use Expand-Archive via encoded command to avoid shell injection
        // Build the PowerShell script and encode it as Base64 UTF-16LE
        const psScript = `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`;
        const encoded = Buffer.from(psScript, "utf16le").toString("base64");
        proc = spawn("powershell", [
            "-NoProfile",
            "-NonInteractive",
            "-EncodedCommand",
            encoded
        ]);
    } else {
        // Unix (tar) - use -xzf for .tar.gz archives (Adoptium delivers tar.gz on Linux/macOS)
        proc = spawn("tar", ["-xzf", archivePath, "-C", destDir]);
    }

    proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Extraction failed with code ${code}`));
    });

    proc.on("error", (err) => {
        reject(new Error(`Failed to run extraction: ${err.message}`));
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
 * @param version Java version (e.g. 8, 11, 17)
 * @param onProgress Callback used to report download/extraction progress
 */
export async function ensureJavaInstalled(
    version: number,
    onProgress?: (stage: 'downloading' | 'extracting', percent: number, downloaded?: number, total?: number) => void
): Promise<string> {
  // Ensure runtimes directory exists
  try {
    await fs.mkdir(RUNTIMES_DIR, { recursive: true });
  } catch (e) {}

  const runtimeName = `java-${version}`;
  const runtimePath = path.join(RUNTIMES_DIR, runtimeName);
  
  const executableName = process.platform === "win32" ? "java.exe" : "java";

  // Double check if existing installation is valid
  try {
      const jdkHome = await findJdkHome(runtimePath);
      if (jdkHome) {
          const existingBin = path.join(jdkHome, "bin", executableName);
          try {
              await fs.access(existingBin);
              if (onProgress) onProgress('downloading', 100); // Already done
              return existingBin;
          } catch {}
      }
  } catch {}

  // Not found, download it
  console.log(`Downloading Java ${version}...`);
  if (onProgress) onProgress('downloading', 0, 0, 0);
  
  const platform = getPlatformString();
  const arch = getArchString();
  const url = `https://api.adoptium.net/v3/binary/latest/${version}/ga/${platform}/${arch}/jdk/hotspot/normal/eclipse`;

  // Adoptium delivers .zip on Windows, .tar.gz on Linux/macOS
  const archiveExt = process.platform === "win32" ? ".zip" : ".tar.gz";
  const archiveName = `java-${version}${archiveExt}`;
  const archivePath = path.join(RUNTIMES_DIR, archiveName);

  await downloadFile(url, archivePath, (downloaded, total) => {
      let percent = 0;
      if (total > 0) percent = (downloaded / total) * 100;
      if (onProgress) onProgress('downloading', percent, downloaded, total);
  });
  
  // Extract
  if (onProgress) onProgress('extracting', 0);
  
  // Remove old runtime directory if it exists (clean install)
  try { await fs.rm(runtimePath, { recursive: true, force: true }); } catch {}
  await fs.mkdir(runtimePath, { recursive: true });
  
  await extractArchive(archivePath, runtimePath);
  
  // Clean up archive
  await fs.unlink(archivePath);

  // Find the JDK home (handles nested directory from extraction)
  const jdkHome = await findJdkHome(runtimePath);
  if (!jdkHome) throw new Error(`Java ${version} installed but JDK home not found.`);

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

  if (onProgress) onProgress('extracting', 100);
  return bin;
}

/**
 * Derives JAVA_HOME from a java binary path.
 * e.g. /path/to/jdk-21/bin/java -> /path/to/jdk-21
 */
export function getJavaHome(javaBinaryPath: string): string {
  // java binary is at <JAVA_HOME>/bin/java
  return path.dirname(path.dirname(javaBinaryPath));
}
