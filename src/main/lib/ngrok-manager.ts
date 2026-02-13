import { app, BrowserWindow } from "electron";
import path from "path";
import fs from "fs/promises";
import { createWriteStream, existsSync, mkdirSync } from "fs";
import https from "https";
import http from "http";
import os from "os";
import { spawn, ChildProcess } from "child_process";
import { NgrokStatus, InstallNgrokResult, StartNgrokResult } from "@shared/types";

const NGROK_DIR = path.join(app.getPath("userData"), "ngrok");
const NGROK_CONFIG_DIR = path.join(NGROK_DIR, "config");

// Platform-specific binary names
const getNgrokBinaryName = (): string => {
  const platform = process.platform;
  
  if (platform === "win32") {
    return "ngrok.exe";
  } else if (platform === "darwin") {
    return "ngrok";
  } else if (platform === "linux") {
    return "ngrok";
  }
  
  throw new Error(`Unsupported platform: ${platform}`);
};

// Download URLs for ngrok
const getNgrokDownloadUrl = (): string => {
  const platform = process.platform;
  const arch = process.arch;
  
  if (platform === "win32" && arch === "x64") {
    return "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip";
  } else if (platform === "darwin" && arch === "x64") {
    return "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-amd64.zip";
  } else if (platform === "darwin" && arch === "arm64") {
    return "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-arm64.zip";
  } else if (platform === "linux" && arch === "x64") {
    return "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.zip";
  } else if (platform === "linux" && arch === "arm64") {
    return "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.zip";
  }
  
  throw new Error(`Unsupported platform/arch: ${platform}/${arch}`);
};

// Track active ngrok processes per server
const activeTunnels: Map<string, { process: ChildProcess; publicUrl: string; port: number }> = new Map();

// Track installation progress
let installing = false;

/**
 * Get the path to the ngrok binary
 */
export function getNgrokPath(): string {
  return path.join(NGROK_DIR, getNgrokBinaryName());
}

/**
 * Check if ngrok is installed
 */
export async function isNgrokInstalled(): Promise<boolean> {
  const ngrokPath = getNgrokPath();
  try {
    await fs.access(ngrokPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get ngrok installation status
 */
export function isInstalling(): boolean {
  return installing;
}

/**
 * Download and install ngrok
 */
export async function installNgrok(
  _mainWindow: BrowserWindow,
  onProgress?: (percent: number) => void
): Promise<InstallNgrokResult> {
  if (installing) {
    return { success: false, error: "Installation already in progress" };
  }

  installing = true;

  try {
    // Create ngrok directory if it doesn't exist
    if (!existsSync(NGROK_DIR)) {
      mkdirSync(NGROK_DIR, { recursive: true });
    }

    const ngrokPath = getNgrokPath();
    
    // Check if already installed
    if (await isNgrokInstalled()) {
      installing = false;
      return { success: true };
    }

    const downloadUrl = getNgrokDownloadUrl();
    const zipPath = path.join(NGROK_DIR, "ngrok.zip");

    // Download ngrok
    const downloadResult = await downloadFile(downloadUrl, zipPath, onProgress);
    if (!downloadResult.success) {
      installing = false;
      return { success: false, error: downloadResult.error };
    }

    // Extract the zip file
    const extractResult = await extractZip(zipPath, NGROK_DIR);
    if (!extractResult.success) {
      installing = false;
      return { success: false, error: extractResult.error };
    }

    // Make the binary executable on Unix systems
    if (process.platform !== "win32") {
      await fs.chmod(ngrokPath, 0o755);
    }

    // Clean up the zip file
    try {
      await fs.unlink(zipPath);
    } catch {
      // Ignore cleanup errors
    }

    // Create config directory
    if (!existsSync(NGROK_CONFIG_DIR)) {
      mkdirSync(NGROK_CONFIG_DIR, { recursive: true });
    }

    installing = false;
    return { success: true };
  } catch (error) {
    installing = false;
    const message = error instanceof Error ? error.message : "Unknown error during installation";
    return { success: false, error: message };
  }
}

/**
 * Download a file with progress tracking
 */
async function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const file = createWriteStream(destPath);
    const protocol = url.startsWith("https") ? https : http;

    let totalBytes = 0;
    let downloadedBytes = 0;

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          downloadFile(redirectUrl, destPath, onProgress).then(resolve);
          return;
        }
      }

      if (response.statusCode !== 200) {
        file.close();
        resolve({ success: false, error: `HTTP ${response.statusCode}` });
        return;
      }

      totalBytes = parseInt(response.headers["content-length"] || "0", 10);
      response.pipe(file);

      response.on("data", (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0 && onProgress) {
          const percent = Math.round((downloadedBytes / totalBytes) * 100);
          onProgress(percent);
        }
      });

      file.on("finish", () => {
        file.close();
        resolve({ success: true });
      });
    });

    request.on("error", (err) => {
      file.close();
      resolve({ success: false, error: err.message });
    });

    file.on("error", (err) => {
      file.close();
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Extract a zip file (simple implementation for ngrok zip)
 */
async function extractZip(
  zipPath: string,
  destDir: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use the system's unzip command or PowerShell on Windows
    const platform = process.platform;
    
    return new Promise((resolve) => {
      let proc: ReturnType<typeof spawn>;

      if (platform === "win32") {
        // Use Expand-Archive via encoded command to avoid shell injection
        const psScript = `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`;
        const encoded = Buffer.from(psScript, "utf16le").toString("base64");
        proc = spawn("powershell", [
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
          encoded
        ]);
      } else {
        // Use unzip on Unix - arguments passed as array, no shell interpolation
        proc = spawn("unzip", ["-o", zipPath, "-d", destDir]);
      }
      let stderr = "";

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: `Extraction failed: ${stderr}` });
        }
      });

      proc.on("error", (err) => {
        resolve({ success: false, error: `Failed to run extraction: ${err.message}` });
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown extraction error";
    return { success: false, error: message };
  }
}

/**
 * Configure ngrok authtoken
 */
export async function configureNgrokAuthtoken(authtoken: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate authtoken format (alphanumeric + underscores/hyphens only)
    if (!authtoken || !/^[a-zA-Z0-9_\-]+$/.test(authtoken.trim())) {
      return { success: false, error: "Invalid authtoken format" };
    }

    // Ensure ngrok is installed
    if (!(await isNgrokInstalled())) {
      const installResult = await installNgrok(null as any, () => {});
      if (!installResult.success) {
        return { success: false, error: "Failed to install ngrok: " + (installResult.error || "Unknown error") };
      }
    }

    const ngrokPath = getNgrokPath();
    const configPath = path.join(NGROK_CONFIG_DIR, "ngrok.yml");
    
    // Ensure config directory exists
    if (!existsSync(NGROK_CONFIG_DIR)) {
      mkdirSync(NGROK_CONFIG_DIR, { recursive: true });
    }

    // Run ngrok config add-authtoken
    return new Promise((resolve) => {
      const proc = spawn(ngrokPath, [
        "config",
        "add-authtoken",
        authtoken,
        "--config",
        configPath
      ]);

      let stderr = "";
      let stdout = "";

      proc.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: stderr || stdout || `Exit code: ${code}` });
        }
      });

      proc.on("error", (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error configuring authtoken";
    return { success: false, error: message };
  }
}

/**
 * Check if authtoken is configured
 */
export async function isAuthtokenConfigured(): Promise<boolean> {
  try {
    const configPath = path.join(NGROK_CONFIG_DIR, "ngrok.yml");
    if (!existsSync(configPath)) {
      return false;
    }
    
    const configContent = await fs.readFile(configPath, "utf-8");
    // Check if auth_token is present in config
    return configContent.includes("auth_token:") || configContent.includes("authtoken:");
  } catch {
    return false;
  }
}

/**
 * Start ngrok tunnel for a server
 */
export async function startNgrokTunnel(
  _mainWindow: BrowserWindow,
  serverId: string,
  port: number
): Promise<StartNgrokResult> {
  try {
    // Validate port number
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return { success: false, error: "Invalid port number" };
    }

    // Check if tunnel already exists for this server
    const existingTunnel = activeTunnels.get(serverId);
    if (existingTunnel) {
      return { success: true, publicUrl: existingTunnel.publicUrl };
    }

    // Check if ngrok is installed
    if (!(await isNgrokInstalled())) {
      return { success: false, error: "Ngrok is not installed" };
    }

    const ngrokPath = getNgrokPath();
    const configPath = path.join(NGROK_CONFIG_DIR, "ngrok.yml");
    
    // Check if config file exists, if not create a basic one
    const configExists = existsSync(configPath);
    if (!configExists) {
      // Create a minimal config file
      await fs.mkdir(NGROK_CONFIG_DIR, { recursive: true });
      await fs.writeFile(configPath, "version: 2\n", "utf-8");
    }

    // Start ngrok process
    // ngrok tcp <port> --log=stdout
    const proc = spawn(ngrokPath, [
      "tcp",
      String(port),
      "--log=stdout",
      "--config",
      configPath
    ], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false
    });

    let publicUrl = "";
    let stderr = "";

    proc.stdout?.on("data", (data: Buffer) => {
      const output = data.toString();
      
      // Parse the public URL from ngrok output
      // The URL appears in logs like: "url=tcp://0.tcp.ngrok.io:12345"
      const urlMatch = output.match(/url=(tcp:\/\/[^\s]+)/);
      if (urlMatch) {
        publicUrl = urlMatch[1];
      }

      // Also check for tunnel established message
      const tunnelMatch = output.match(/Tunnel established at (tcp:\/\/[^\s]+)/);
      if (tunnelMatch) {
        publicUrl = tunnelMatch[1];
      }
    });

    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    // Wait for tunnel to be established (poll the ngrok API)
    const apiUrl = "http://127.0.0.1:4040/api/tunnels";
    
    // Wait up to 10 seconds for the tunnel to be ready
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts && !publicUrl) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      attempts++;

      try {
        // Query ngrok API for tunnel info
        const tunnelInfo = await fetchTunnelInfo(apiUrl);
        if (tunnelInfo && tunnelInfo.public_url) {
          publicUrl = tunnelInfo.public_url;
          break;
        }
      } catch {
        // API not ready yet, continue waiting
      }
    }

    if (!publicUrl) {
      proc.kill();
      return { success: false, error: "Failed to get tunnel URL. Ngrok may require authentication." };
    }

    // Strip the tcp:// prefix for Minecraft server address format
    // Minecraft uses format: host:port (without tcp://)
    const cleanUrl = publicUrl.replace(/^tcp:\/\//, "");

    // Store the active tunnel
    activeTunnels.set(serverId, { process: proc, publicUrl: cleanUrl, port });

    // Handle process exit
    proc.on("exit", () => {
      activeTunnels.delete(serverId);
    });

    proc.on("error", (err) => {
      console.error(`Ngrok process error for ${serverId}:`, err);
      activeTunnels.delete(serverId);
    });

    return { success: true, publicUrl: cleanUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error starting tunnel";
    return { success: false, error: message };
  }
}

/**
 * Fetch tunnel info from ngrok API
 */
async function fetchTunnelInfo(apiUrl: string): Promise<{ public_url: string } | null> {
  return new Promise((resolve, reject) => {
    http.get(apiUrl, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.tunnels && json.tunnels.length > 0) {
            resolve({ public_url: json.tunnels[0].public_url });
          } else {
            resolve(null);
          }
        } catch {
          reject(new Error("Failed to parse tunnel info"));
        }
      });
    }).on("error", reject);
  });
}

/**
 * Stop ngrok tunnel for a server
 */
export async function stopNgrokTunnel(serverId: string): Promise<{ success: boolean; error?: string }> {
  const tunnel = activeTunnels.get(serverId);
  if (!tunnel) {
    return { success: true };
  }

  try {
    tunnel.process.kill();
    activeTunnels.delete(serverId);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to stop tunnel";
    return { success: false, error: message };
  }
}

/**
 * Get ngrok status for a server
 */
export async function getNgrokStatus(serverId: string): Promise<NgrokStatus> {
  const installed = await isNgrokInstalled();
  const tunnel = activeTunnels.get(serverId);

  return {
    installed,
    installing,
    tunnelActive: !!tunnel,
    publicUrl: tunnel?.publicUrl
  };
}

/**
 * Get all active tunnels
 */
export function getActiveTunnels(): Map<string, { process: ChildProcess; publicUrl: string; port: number }> {
  return activeTunnels;
}

/**
 * Stop all ngrok tunnels
 */
export async function stopAllTunnels(): Promise<void> {
  for (const [serverId, tunnel] of activeTunnels) {
    try {
      tunnel.process.kill();
    } catch (error) {
      console.error(`Failed to stop tunnel for ${serverId}:`, error);
    }
  }
  activeTunnels.clear();
}

/**
 * Get local IP address
 */
export function getLocalIp(): string {
  const interfaces = os.networkInterfaces();

  // Look for IPv4 address on common interfaces
  const interfaceNames = ["Ethernet", "Wi-Fi", "en0", "eth0", "wlan0"];
  
  for (const name of interfaceNames) {
    const iface = interfaces[name];
    if (iface) {
      for (const addr of iface) {
        if (addr.family === "IPv4" && !addr.internal) {
          return addr.address;
        }
      }
    }
  }

  // Fallback: search all interfaces
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (iface) {
      for (const addr of iface) {
        if (addr.family === "IPv4" && !addr.internal) {
          return addr.address;
        }
      }
    }
  }

  return "localhost";
 }

/**
 * Validate ngrok authtoken by testing it with ngrok's API
 * This actually validates the token works, not just format
 */
export async function validateNgrokAuthtoken(authtoken: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // First, basic validation
    if (!authtoken || authtoken.trim().length === 0) {
      return { valid: false, error: "Authtoken is required" };
    }

    const token = authtoken.trim();
    
    // Validate authtoken format (alphanumeric + underscores/hyphens only)
    if (!/^[a-zA-Z0-9_\-]+$/.test(token)) {
      return { valid: false, error: "Invalid authtoken format. Only alphanumeric characters, underscores and hyphens are allowed." };
    }

    // Ngrok tokens typically are 30+ characters
    if (token.length < 20) {
      return { valid: false, error: "Authtoken is too short. Please check your token at dashboard.ngrok.com" };
    }

    // Ensure ngrok is installed first
    if (!(await isNgrokInstalled())) {
      // Need to install ngrok first - download it
      const installResult = await installNgrok(null as any, () => {});
      if (!installResult.success) {
        return { valid: false, error: "Failed to install ngrok: " + (installResult.error || "Unknown error") };
      }
    }

    const ngrokPath = getNgrokPath();
    const tempConfigPath = path.join(NGROK_DIR, "temp_validate.yml");
    
    return new Promise((resolve) => {
      const proc = spawn(ngrokPath, [
        "config",
        "add-authtoken",
        token,
        "--config",
        tempConfigPath
      ]);

      let stderr = "";
      let stdout = "";

      proc.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", async (code) => {
        // Clean up temp config
        try {
          await fs.unlink(tempConfigPath);
        } catch {}
        
        if (code === 0) {
          resolve({ valid: true });
        } else {
          // Parse error message for more user-friendly output
          let errorMsg = stderr || stdout || `Exit code: ${code}`;
          
          // Check for specific error patterns
          if (errorMsg.toLowerCase().includes("invalid") ||
              errorMsg.toLowerCase().includes("not found") ||
              errorMsg.toLowerCase().includes("unauthorized") ||
              errorMsg.toLowerCase().includes("authentication failed")) {
            errorMsg = "Invalid authtoken. Please check your token at dashboard.ngrok.com";
          } else if (errorMsg.toLowerCase().includes("network") ||
                     errorMsg.toLowerCase().includes("connection") ||
                     errorMsg.toLowerCase().includes("timeout")) {
            errorMsg = "Network error. Please check your internet connection.";
          }
          resolve({ valid: false, error: errorMsg });
        }
      });

      proc.on("error", (err) => {
        resolve({ valid: false, error: err.message });
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error validating authtoken";
    return { valid: false, error: message };
  }
}

/**
 * Get censored authtoken (shows last 7 characters)
 */
export async function getNgrokAuthtokenCensored(): Promise<string | null> {
  // Check multiple possible config locations
  const configPaths = [
    path.join(NGROK_CONFIG_DIR, "ngrok.yml"),
    path.join(app.getPath("userData"), "ngrok", "ngrok.yml"),
    path.join(app.getPath("home"), ".ngrok2", "ngrok.yml"),
  ];
  
  for (const configPath of configPaths) {
    try {
      const content = await fs.readFile(configPath, "utf-8");
      
      // Extract authtoken from config (supports both auth_token and authtoken)
      const match = content.match(/(?:auth_token|authtoken):\s*(.+)/);
      if (match) {
        const token = match[1].trim();
        // Show last 7 characters, censor the rest
        if (token.length > 7) {
          return "****_****_****_" + token.slice(-7);
        }
        return "****_" + token;
      }
    } catch {
      // Try next path
      continue;
    }
  }
  
  return null;
}

/**
 * Check if ngrok is enabled globally
 */
export async function isNgrokEnabled(): Promise<boolean> {
  const settingsPath = path.join(app.getPath("userData"), "ngrok_settings.json");
  try {
    const content = await fs.readFile(settingsPath, "utf-8");
    const settings = JSON.parse(content) as { enabled: boolean };
    return settings.enabled === true;
  } catch {
    return false; // Default to disabled if file doesn't exist or can't be read
  }
}

/**
 * Set ngrok enabled state
 */
export async function setNgrokEnabled(enabled: boolean): Promise<void> {
  const settingsPath = path.join(app.getPath("userData"), "ngrok_settings.json");
  await fs.writeFile(settingsPath, JSON.stringify({ enabled }), "utf-8");
}

/**
 * Remove ngrok authtoken
 */
export async function removeNgrokAuthtoken(): Promise<{ success: boolean; error?: string }> {
  try {
    const configPath = path.join(NGROK_CONFIG_DIR, "ngrok.yml");
    await fs.unlink(configPath);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove authtoken";
    return { success: false, error: message };
  }
}
