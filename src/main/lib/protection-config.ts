import { app } from "electron";
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { TCPShieldConfig } from "@shared/types";

const CONFIG_DIR = path.join(app.getPath("userData"), "tcpshield");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG: TCPShieldConfig = {
  apiKey: "",
  enabled: false,
  debug: false,
};

/**
 * Ensure the config directory exists
 */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load TCPShield config from disk
 */
export async function loadProtectionConfig(): Promise<TCPShieldConfig> {
  try {
    ensureConfigDir();
    if (!existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG };
    }
    const raw = await fs.readFile(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      apiKey: parsed.apiKey ?? DEFAULT_CONFIG.apiKey,
      enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
      debug: parsed.debug ?? DEFAULT_CONFIG.debug,
      networkId: parsed.networkId,
    };
  } catch (error) {
    console.error("[tcpshield-config] Failed to load config:", error);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save TCPShield config to disk
 */
export async function saveProtectionConfig(config: TCPShieldConfig): Promise<void> {
  try {
    ensureConfigDir();
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
    if (config.debug) {
      console.log("[tcpshield-config] Config saved");
    }
  } catch (error) {
    console.error("[tcpshield-config] Failed to save config:", error);
    throw error;
  }
}

/**
 * Update partial config fields and persist
 */
export async function updateProtectionConfig(
  partial: Partial<TCPShieldConfig>
): Promise<TCPShieldConfig> {
  const current = await loadProtectionConfig();
  const updated: TCPShieldConfig = {
    ...current,
    ...partial,
  };
  await saveProtectionConfig(updated);
  return updated;
}

/**
 * Get the stored API key (censored for display)
 */
export async function getApiKeyCensored(): Promise<string | null> {
  const config = await loadProtectionConfig();
  if (!config.apiKey) return null;
  const key = config.apiKey;
  if (key.length <= 8) return "****";
  return key.substring(0, 4) + "****" + key.substring(key.length - 4);
}

/**
 * Check if an API key is configured
 */
export async function hasApiKey(): Promise<boolean> {
  const config = await loadProtectionConfig();
  return !!config.apiKey;
}
