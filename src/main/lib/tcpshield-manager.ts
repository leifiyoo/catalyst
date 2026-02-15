import https from "https";
import {
  TCPShieldNetwork,
  TCPShieldBackend,
  TCPShieldStatus,
  TCPShieldConfig,
} from "@shared/types";
import {
  loadProtectionConfig,
  updateProtectionConfig,
} from "./protection-config";

const API_BASE = "https://api.tcpshield.com";

// ---- Internal HTTP helper ----

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

function apiRequest<T = unknown>(
  method: string,
  path: string,
  apiKey: string,
  body?: unknown,
  debug = false
): Promise<ApiResponse<T>> {
  return new Promise((resolve) => {
    const url = new URL(path, API_BASE);
    const postData = body ? JSON.stringify(body) : undefined;

    if (debug) {
      console.log(`[tcpshield] ${method} ${url.pathname}`);
    }

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(postData ? { "Content-Length": Buffer.byteLength(postData) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (debug) {
          console.log(`[tcpshield] Response ${res.statusCode}: ${data.substring(0, 200)}`);
        }
        try {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ success: true, data: parsed as T });
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            resolve({ success: false, error: "Invalid or expired API key" });
          } else {
            const parsed = data ? JSON.parse(data) : {};
            resolve({
              success: false,
              error: parsed.message || parsed.error || `HTTP ${res.statusCode}`,
            });
          }
        } catch {
          resolve({ success: false, error: `Failed to parse response (HTTP ${res.statusCode})` });
        }
      });
    });

    req.on("error", (err) => {
      if (debug) {
        console.error("[tcpshield] Request error:", err.message);
      }
      resolve({ success: false, error: err.message });
    });

    req.setTimeout(15000, () => {
      req.destroy();
      resolve({ success: false, error: "Request timed out" });
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// ---- Public API ----

/**
 * Set the TCPShield API key and validate it
 */
export async function setApiKey(
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: "API key cannot be empty" };
  }

  const trimmed = apiKey.trim();

  // Validate by attempting to list networks
  const result = await apiRequest<{ data: TCPShieldNetwork[] }>(
    "GET",
    "/v2/networks",
    trimmed,
    undefined,
    true
  );

  if (!result.success) {
    return { success: false, error: result.error || "Failed to validate API key" };
  }

  await updateProtectionConfig({ apiKey: trimmed });
  return { success: true };
}

/**
 * Remove the stored API key
 */
export async function removeApiKey(): Promise<{ success: boolean; error?: string }> {
  try {
    await updateProtectionConfig({ apiKey: "", enabled: false, networkId: undefined });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * List all TCPShield networks for the authenticated account
 */
export async function listNetworks(): Promise<{
  success: boolean;
  networks?: TCPShieldNetwork[];
  error?: string;
}> {
  const config = await loadProtectionConfig();
  if (!config.apiKey) {
    return { success: false, error: "No API key configured" };
  }

  const result = await apiRequest<{ data: TCPShieldNetwork[] }>(
    "GET",
    "/v2/networks",
    config.apiKey,
    undefined,
    config.debug
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const networks: TCPShieldNetwork[] = (result.data?.data || []).map((n: any) => ({
    id: n.id,
    name: n.name,
    connections_per_second_threshold: n.connections_per_second_threshold ?? 0,
    client_ban_seconds: n.client_ban_seconds ?? 0,
    client_allow_seconds: n.client_allow_seconds ?? 0,
  }));

  return { success: true, networks };
}

/**
 * List backends for a specific network
 */
export async function listBackends(
  networkId: number
): Promise<{ success: boolean; backends?: TCPShieldBackend[]; error?: string }> {
  const config = await loadProtectionConfig();
  if (!config.apiKey) {
    return { success: false, error: "No API key configured" };
  }

  const result = await apiRequest<{ data: TCPShieldBackend[] }>(
    "GET",
    `/v2/networks/${networkId}/backends`,
    config.apiKey,
    undefined,
    config.debug
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const backends: TCPShieldBackend[] = (result.data?.data || []).map((b: any) => ({
    id: b.id,
    network_id: b.network_id ?? networkId,
    address: b.address,
    port: b.port,
    online: b.online ?? false,
  }));

  return { success: true, backends };
}

/**
 * Add a backend server to a TCPShield network
 */
export async function addBackend(
  networkId: number,
  address: string,
  port: number
): Promise<{ success: boolean; backend?: TCPShieldBackend; error?: string }> {
  const config = await loadProtectionConfig();
  if (!config.apiKey) {
    return { success: false, error: "No API key configured" };
  }

  if (!address || !address.trim()) {
    return { success: false, error: "Address cannot be empty" };
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { success: false, error: "Invalid port number" };
  }

  const result = await apiRequest<{ data: TCPShieldBackend }>(
    "POST",
    `/v2/networks/${networkId}/backends`,
    config.apiKey,
    { address: address.trim(), port },
    config.debug
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const b = result.data?.data;
  if (!b) {
    return { success: false, error: "No backend data in response" };
  }

  const backend: TCPShieldBackend = {
    id: (b as any).id,
    network_id: (b as any).network_id ?? networkId,
    address: (b as any).address,
    port: (b as any).port,
    online: (b as any).online ?? false,
  };

  return { success: true, backend };
}

/**
 * Remove a backend server from a TCPShield network
 */
export async function removeBackend(
  networkId: number,
  backendId: number
): Promise<{ success: boolean; error?: string }> {
  const config = await loadProtectionConfig();
  if (!config.apiKey) {
    return { success: false, error: "No API key configured" };
  }

  const result = await apiRequest(
    "DELETE",
    `/v2/networks/${networkId}/backends/${backendId}`,
    config.apiKey,
    undefined,
    config.debug
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true };
}

/**
 * Get the current TCPShield protection status
 */
export async function getProtectionStatus(): Promise<TCPShieldStatus> {
  const config = await loadProtectionConfig();

  if (!config.apiKey) {
    return {
      enabled: false,
      connected: false,
      backends: [],
    };
  }

  // Try to fetch networks to verify connection
  const networksResult = await listNetworks();
  if (!networksResult.success) {
    return {
      enabled: config.enabled,
      connected: false,
      backends: [],
      error: networksResult.error,
    };
  }

  const networks = networksResult.networks || [];
  let selectedNetwork: TCPShieldNetwork | undefined;
  let backends: TCPShieldBackend[] = [];

  if (config.networkId) {
    selectedNetwork = networks.find((n) => n.id === config.networkId);
  }
  if (!selectedNetwork && networks.length > 0) {
    selectedNetwork = networks[0];
    // Auto-select first network if none configured
    await updateProtectionConfig({ networkId: selectedNetwork.id });
  }

  if (selectedNetwork) {
    const backendsResult = await listBackends(selectedNetwork.id);
    if (backendsResult.success) {
      backends = backendsResult.backends || [];
    }
  }

  return {
    enabled: config.enabled,
    connected: true,
    networkId: selectedNetwork?.id,
    networkName: selectedNetwork?.name,
    backends,
  };
}

/**
 * Enable TCPShield protection
 */
export async function enableProtection(
  _serverId: string
): Promise<{ success: boolean; error?: string }> {
  const config = await loadProtectionConfig();
  if (!config.apiKey) {
    return { success: false, error: "No API key configured. Please set an API key first." };
  }

  await updateProtectionConfig({ enabled: true });
  return { success: true };
}

/**
 * Disable TCPShield protection
 */
export async function disableProtection(
  _serverId: string
): Promise<{ success: boolean; error?: string }> {
  await updateProtectionConfig({ enabled: false });
  return { success: true };
}

/**
 * Get the current config (for UI display)
 */
export async function getConfig(): Promise<TCPShieldConfig | null> {
  try {
    return await loadProtectionConfig();
  } catch {
    return null;
  }
}

/**
 * Update config fields
 */
export async function setConfig(
  partial: Partial<TCPShieldConfig>
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateProtectionConfig(partial);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
