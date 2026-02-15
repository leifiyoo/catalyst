import https from "https";
import {
  loadProtectionConfig,
  updateServerProtectionConfig,
  getServerProtectionConfig,
} from "./protection-config";

// ---- TCPShield API Types ----

type TCPShieldNetwork = {
  id: number;
  name: string;
  connections_per_second_threshold: number;
  client_ban_seconds: number;
  verified: boolean;
};

type TCPShieldDomain = {
  id: number;
  name: string;
  network_id: number;
};

type TCPShieldBackendSet = {
  id: number;
  name: string;
  network_id: number;
  backends: TCPShieldBackend[];
};

type TCPShieldBackend = {
  id: number;
  address: string;
  port: number;
  backend_set_id: number;
};

export type TCPShieldProtectionStatus = {
  configured: boolean;
  enabled: boolean;
  networkId?: number;
  networkName?: string;
  domainName?: string;
  backendAddress?: string;
  error?: string;
};

// ---- Helpers ----

function debugLog(debug: boolean, ...args: unknown[]): void {
  if (debug) {
    console.log("[tcpshield]", ...args);
  }
}

/**
 * Make an authenticated request to the TCPShield API
 */
function apiRequest<T>(
  method: string,
  endpoint: string,
  apiKey: string,
  body?: unknown
): Promise<T> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const options: https.RequestOptions = {
      hostname: "api.tcpshield.com",
      port: 443,
      path: endpoint,
      method,
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => {
        responseData += chunk;
      });
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(responseData) as T);
          } catch {
            resolve(responseData as unknown as T);
          }
        } else {
          let errorMessage = `HTTP ${res.statusCode}`;
          try {
            const errorBody = JSON.parse(responseData);
            if (errorBody.message) errorMessage = errorBody.message;
            else if (errorBody.error) errorMessage = errorBody.error;
          } catch {
            // Use status code message
          }
          reject(new Error(errorMessage));
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`Network error: ${err.message}`));
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

// ---- Public API ----

/**
 * Validate a TCPShield API key by attempting to list networks
 */
export async function validateApiKey(
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    await apiRequest<TCPShieldNetwork[]>("GET", "/v2/networks", apiKey);
    return { valid: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to validate API key";
    return { valid: false, error: message };
  }
}

/**
 * List all networks for the authenticated user
 */
export async function listNetworks(
  apiKey: string
): Promise<TCPShieldNetwork[]> {
  const config = await loadProtectionConfig();
  debugLog(config.debug, "Listing networks");
  return apiRequest<TCPShieldNetwork[]>("GET", "/v2/networks", apiKey);
}

/**
 * Add a server to TCPShield protection.
 * Creates a network, domain, and backend set for the server.
 */
export async function addServerProtection(
  serverId: string,
  serverName: string,
  serverAddress: string,
  serverPort: number
): Promise<{ success: boolean; error?: string }> {
  const config = await loadProtectionConfig();
  const { apiKey, debug } = config;

  if (!apiKey) {
    return { success: false, error: "TCPShield API key not configured" };
  }

  try {
    debugLog(debug, "Adding protection for server:", serverId, serverName);

    // 1. Create a network
    debugLog(debug, "Creating network:", serverName);
    const network = await apiRequest<TCPShieldNetwork>(
      "POST",
      "/v2/networks",
      apiKey,
      { name: `Catalyst - ${serverName}` }
    );
    debugLog(debug, "Network created:", network.id);

    // 2. Create a domain
    const domainName = `${serverName.toLowerCase().replace(/[^a-z0-9]/g, "-")}.tcpshield.com`;
    debugLog(debug, "Creating domain:", domainName);
    const domain = await apiRequest<TCPShieldDomain>(
      "POST",
      `/v2/networks/${network.id}/domains`,
      apiKey,
      { name: domainName }
    );
    debugLog(debug, "Domain created:", domain.id);

    // 3. Create a backend set with the server address
    debugLog(debug, "Creating backend set for:", serverAddress, serverPort);
    const backendSet = await apiRequest<TCPShieldBackendSet>(
      "POST",
      `/v2/networks/${network.id}/backend-sets`,
      apiKey,
      {
        name: `${serverName} Backend`,
        backends: [{ address: serverAddress, port: serverPort }],
      }
    );
    debugLog(debug, "Backend set created:", backendSet.id);

    // Save config
    await updateServerProtectionConfig(serverId, {
      networkId: String(network.id),
      domainId: String(domain.id),
      backendId: String(backendSet.id),
      enabled: true,
    });

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add server protection";
    debugLog(debug, "Error adding protection:", message);
    return { success: false, error: message };
  }
}

/**
 * Remove a server from TCPShield protection.
 * Deletes the network (which cascades to domains and backends).
 */
export async function removeServerProtection(
  serverId: string
): Promise<{ success: boolean; error?: string }> {
  const config = await loadProtectionConfig();
  const { apiKey, debug } = config;

  if (!apiKey) {
    return { success: false, error: "TCPShield API key not configured" };
  }

  const serverConfig = await getServerProtectionConfig(serverId);
  if (!serverConfig.networkId) {
    // Nothing to remove, just clear config
    await updateServerProtectionConfig(serverId, {
      networkId: undefined,
      domainId: undefined,
      backendId: undefined,
      enabled: false,
    });
    return { success: true };
  }

  try {
    debugLog(debug, "Removing protection for server:", serverId);

    // Delete the network (cascades to domains and backends)
    await apiRequest<void>(
      "DELETE",
      `/v2/networks/${serverConfig.networkId}`,
      apiKey
    );
    debugLog(debug, "Network deleted:", serverConfig.networkId);

    // Clear config
    await updateServerProtectionConfig(serverId, {
      networkId: undefined,
      domainId: undefined,
      backendId: undefined,
      enabled: false,
    });

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove server protection";
    debugLog(debug, "Error removing protection:", message);
    return { success: false, error: message };
  }
}

/**
 * Get the protection status for a server
 */
export async function getProtectionStatus(
  serverId: string
): Promise<TCPShieldProtectionStatus> {
  const config = await loadProtectionConfig();
  const { apiKey, debug } = config;

  if (!apiKey) {
    return { configured: false, enabled: false };
  }

  const serverConfig = await getServerProtectionConfig(serverId);
  if (!serverConfig.networkId) {
    return { configured: false, enabled: serverConfig.enabled };
  }

  try {
    debugLog(debug, "Getting protection status for:", serverId);

    // Fetch network details
    const network = await apiRequest<TCPShieldNetwork>(
      "GET",
      `/v2/networks/${serverConfig.networkId}`,
      apiKey
    );

    // Fetch domains
    let domainName: string | undefined;
    try {
      const domains = await apiRequest<TCPShieldDomain[]>(
        "GET",
        `/v2/networks/${serverConfig.networkId}/domains`,
        apiKey
      );
      if (domains.length > 0) {
        domainName = domains[0].name;
      }
    } catch {
      // Domain fetch failed, not critical
    }

    // Fetch backends
    let backendAddress: string | undefined;
    try {
      const backendSets = await apiRequest<TCPShieldBackendSet[]>(
        "GET",
        `/v2/networks/${serverConfig.networkId}/backend-sets`,
        apiKey
      );
      if (backendSets.length > 0 && backendSets[0].backends?.length > 0) {
        const backend = backendSets[0].backends[0];
        backendAddress = `${backend.address}:${backend.port}`;
      }
    } catch {
      // Backend fetch failed, not critical
    }

    return {
      configured: true,
      enabled: serverConfig.enabled,
      networkId: network.id,
      networkName: network.name,
      domainName,
      backendAddress,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get protection status";
    debugLog(debug, "Error getting status:", message);
    return {
      configured: false,
      enabled: false,
      error: message,
    };
  }
}

/**
 * Enable protection for a server (marks it as enabled in config)
 */
export async function enableProtection(
  serverId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateServerProtectionConfig(serverId, { enabled: true });
    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to enable protection";
    return { success: false, error: message };
  }
}

/**
 * Disable protection for a server (marks it as disabled in config)
 */
export async function disableProtection(
  serverId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateServerProtectionConfig(serverId, { enabled: false });
    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to disable protection";
    return { success: false, error: message };
  }
}
