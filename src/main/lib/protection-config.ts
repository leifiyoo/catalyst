import { app } from "electron";
import path from "path";
import fs from "fs/promises";

export type ProtectionServerConfig = {
  networkId?: string;
  domainId?: string;
  backendId?: string;
  enabled: boolean;
};

export type ProtectionConfig = {
  apiKey: string;
  debug: boolean;
  servers: Record<string, ProtectionServerConfig>;
};

const CONFIG_PATH = path.join(app.getPath("userData"), "tcpshield_config.json");

const DEFAULT_CONFIG: ProtectionConfig = {
  apiKey: "",
  debug: false,
  servers: {},
};

/**
 * Load TCPShield protection config from disk
 */
export async function loadProtectionConfig(): Promise<ProtectionConfig> {
  try {
    const content = await fs.readFile(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(content) as Partial<ProtectionConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save TCPShield protection config to disk
 */
export async function saveProtectionConfig(config: ProtectionConfig): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Get protection config for a specific server
 */
export async function getServerProtectionConfig(
  serverId: string
): Promise<ProtectionServerConfig> {
  const config = await loadProtectionConfig();
  return config.servers[serverId] || { enabled: false };
}

/**
 * Update protection config for a specific server
 */
export async function updateServerProtectionConfig(
  serverId: string,
  serverConfig: Partial<ProtectionServerConfig>
): Promise<void> {
  const config = await loadProtectionConfig();
  config.servers[serverId] = {
    ...(config.servers[serverId] || { enabled: false }),
    ...serverConfig,
  };
  await saveProtectionConfig(config);
}

/**
 * Set the TCPShield API key
 */
export async function setProtectionApiKey(apiKey: string): Promise<void> {
  const config = await loadProtectionConfig();
  config.apiKey = apiKey;
  await saveProtectionConfig(config);
}

/**
 * Get the TCPShield API key
 */
export async function getProtectionApiKey(): Promise<string> {
  const config = await loadProtectionConfig();
  return config.apiKey;
}

/**
 * Get censored API key for display
 */
export async function getProtectionApiKeyCensored(): Promise<string | null> {
  const config = await loadProtectionConfig();
  if (!config.apiKey) return null;
  const key = config.apiKey;
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

/**
 * Remove the TCPShield API key
 */
export async function removeProtectionApiKey(): Promise<void> {
  const config = await loadProtectionConfig();
  config.apiKey = "";
  // Clear all server configs too
  config.servers = {};
  await saveProtectionConfig(config);
}

/**
 * Set debug mode
 */
export async function setProtectionDebug(debug: boolean): Promise<void> {
  const config = await loadProtectionConfig();
  config.debug = debug;
  await saveProtectionConfig(config);
}

/**
 * Get debug mode
 */
export async function getProtectionDebug(): Promise<boolean> {
  const config = await loadProtectionConfig();
  return config.debug;
}
