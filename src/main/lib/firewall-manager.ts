/**
 * Windows Firewall Manager
 *
 * Manages Windows Firewall rules using `netsh advfirewall firewall` commands.
 * Designed for KVM servers running Windows to lock down game ports
 * (e.g., only allow TCPShield IP ranges).
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { app } from "electron";

const execFileAsync = promisify(execFile);

// ---- Admin check cache ----
let adminCheckResult: boolean | null = null;

/**
 * Check if the current process is running with administrator privileges.
 * Caches the result since elevation status doesn't change at runtime.
 */
export async function checkAdminPrivileges(): Promise<boolean> {
  if (adminCheckResult !== null) return adminCheckResult;

  if (process.platform !== "win32") {
    adminCheckResult = false;
    return false;
  }

  try {
    // Attempt a harmless netsh query that requires admin
    await execFileAsync("net", ["session"], {
      timeout: 5000,
      windowsHide: true,
    });
    adminCheckResult = true;
    return true;
  } catch {
    adminCheckResult = false;
    return false;
  }
}

// ---- TCPShield published IP ranges ----
// Source: https://docs.tcpshield.com/misc/ip-addresses
const TCPSHIELD_IP_RANGES = [
  "103.28.54.0/24",
  "103.28.55.0/24",
  "103.163.218.0/24",
  "188.64.22.0/24",
  "188.64.23.0/24",
  "198.41.192.0/24",
  "198.41.193.0/24",
  "198.41.194.0/24",
  "198.41.195.0/24",
  "198.41.196.0/24",
  "198.41.197.0/24",
  "198.41.198.0/24",
  "198.41.199.0/24",
  "198.41.200.0/24",
  "198.41.201.0/24",
  "198.41.202.0/24",
  "198.41.203.0/24",
  "198.41.204.0/24",
  "198.41.205.0/24",
  "198.41.206.0/24",
  "198.41.207.0/24",
  "198.41.208.0/24",
  "198.41.209.0/24",
  "198.41.210.0/24",
  "198.41.211.0/24",
  "198.41.212.0/24",
  "198.41.213.0/24",
  "198.41.214.0/24",
  "198.41.215.0/24",
  "198.41.216.0/24",
  "198.41.217.0/24",
  "198.41.218.0/24",
  "198.41.219.0/24",
  "198.41.220.0/24",
  "198.41.221.0/24",
  "198.41.222.0/24",
  "198.41.223.0/24",
];

// Prefix for all rules created by Catalyst
const RULE_PREFIX = "Catalyst_FW_";

// ---- Types ----

export interface FirewallRule {
  name: string;
  enabled: boolean;
  direction: "In" | "Out";
  action: "Allow" | "Block";
  protocol: string;
  localPort: string;
  remoteAddress: string;
  profile: string;
}

export interface FirewallRuleSnapshot {
  timestamp: string;
  rules: FirewallRule[];
}

export interface FirewallAuditEntry {
  timestamp: string;
  action: string;
  details: string;
  success: boolean;
  error?: string;
}

// ---- Audit log ----

const auditLog: FirewallAuditEntry[] = [];

function logAudit(action: string, details: string, success: boolean, error?: string): void {
  const entry: FirewallAuditEntry = {
    timestamp: new Date().toISOString(),
    action,
    details,
    success,
    error,
  };
  auditLog.push(entry);
  if (auditLog.length > 500) {
    auditLog.splice(0, auditLog.length - 500);
  }
  console.log(
    `[firewall] ${success ? "OK" : "FAIL"} ${action}: ${details}${error ? ` (${error})` : ""}`
  );
}

// ---- Helpers ----

function getDataDir(): string {
  return join(app.getPath("userData"), "firewall");
}

async function ensureDataDir(): Promise<string> {
  const dir = getDataDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

async function runNetsh(args: string[]): Promise<string> {
  if (process.platform !== "win32") {
    throw new Error("Firewall management is only supported on Windows");
  }

  const isAdmin = await checkAdminPrivileges();
  if (!isAdmin) {
    throw new Error(
      "Administrator privileges required. Please restart Catalyst as Administrator to manage firewall rules."
    );
  }

  try {
    const { stdout } = await execFileAsync("netsh", args, {
      timeout: 30000,
      windowsHide: true,
    });
    return stdout;
  } catch (err: any) {
    const message = err?.stderr || err?.message || "Unknown netsh error";
    throw new Error(`netsh command failed: ${message}`);
  }
}

function isValidIpOrCidr(value: string): boolean {
  const ipv4Cidr = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
  if (!ipv4Cidr.test(value)) return false;
  const [ip, cidrStr] = value.split("/");
  const parts = ip.split(".").map(Number);
  if (parts.some((p) => p < 0 || p > 255)) return false;
  if (cidrStr !== undefined) {
    const cidr = Number(cidrStr);
    if (cidr < 0 || cidr > 32) return false;
  }
  return true;
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function generateConfirmationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ---- Parse firewall rules ----

function parseCatalystRules(output: string): FirewallRule[] {
  const rules: FirewallRule[] = [];
  const blocks = output.split(/\r?\n\r?\n/).filter((b) => b.trim());

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const ruleData: Record<string, string> = {};

    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.substring(0, colonIdx).trim();
      const val = line.substring(colonIdx + 1).trim();
      if (key && val) {
        ruleData[key] = val;
      }
    }

    const name = ruleData["Rule Name"] || ruleData["Regelname"] || "";
    if (!name) continue;

    rules.push({
      name,
      enabled:
        (ruleData["Enabled"] || ruleData["Aktiviert"] || "").toLowerCase() === "yes" ||
        (ruleData["Enabled"] || ruleData["Aktiviert"] || "").toLowerCase() === "ja",
      direction: (ruleData["Direction"] || ruleData["Richtung"] || "").includes("In") ? "In" : "Out",
      action:
        (ruleData["Action"] || ruleData["Aktion"] || "").toLowerCase().includes("allow") ||
        (ruleData["Action"] || ruleData["Aktion"] || "").toLowerCase().includes("zulassen")
          ? "Allow"
          : "Block",
      protocol: ruleData["Protocol"] || ruleData["Protokoll"] || "Any",
      localPort: ruleData["LocalPort"] || ruleData["Lokaler Port"] || "Any",
      remoteAddress: ruleData["RemoteIP"] || ruleData["Remote-IP"] || "Any",
      profile: ruleData["Profiles"] || ruleData["Profil"] || "Any",
    });
  }

  return rules;
}

// ---- Public API ----

export async function listCatalystRules(): Promise<{
  success: boolean;
  rules?: FirewallRule[];
  error?: string;
}> {
  try {
    // Query only Catalyst-prefixed rules instead of name=all (which loads 200-500+ rules)
    let output: string;
    try {
      output = await runNetsh([
        "advfirewall", "firewall", "show", "rule", `name=${RULE_PREFIX}*`, "verbose",
      ]);
    } catch (err: any) {
      // netsh returns error when no rules match the wildcard — treat as empty
      if (err?.message?.includes("No rules match")) {
        logAudit("listRules", "No Catalyst rules found", true);
        return { success: true, rules: [] };
      }
      throw err;
    }

    const catalystRules = parseCatalystRules(output).filter((r) =>
      r.name.startsWith(RULE_PREFIX)
    );

    logAudit("listRules", `Found ${catalystRules.length} Catalyst rules`, true);
    return { success: true, rules: catalystRules };
  } catch (err: any) {
    const message = err?.message || "Failed to list firewall rules";
    logAudit("listRules", "Failed to list rules", false, message);
    return { success: false, error: message };
  }
}

export async function deleteRule(
  ruleName: string
): Promise<{ success: boolean; error?: string }> {
  if (!ruleName.startsWith(RULE_PREFIX)) {
    return { success: false, error: "Can only delete Catalyst-managed rules" };
  }

  try {
    await runNetsh(["advfirewall", "firewall", "delete", "rule", `name=${ruleName}`]);
    logAudit("deleteRule", `Deleted rule: ${ruleName}`, true);
    return { success: true };
  } catch (err: any) {
    const message = err?.message || "Failed to delete rule";
    logAudit("deleteRule", `Failed to delete: ${ruleName}`, false, message);
    return { success: false, error: message };
  }
}

export async function deleteAllCatalystRules(): Promise<{
  success: boolean;
  deletedCount: number;
  error?: string;
}> {
  try {
    const listResult = await listCatalystRules();
    if (!listResult.success || !listResult.rules) {
      return { success: false, deletedCount: 0, error: listResult.error };
    }

    let deletedCount = 0;
    const errors: string[] = [];

    for (const rule of listResult.rules) {
      const result = await deleteRule(rule.name);
      if (result.success) {
        deletedCount++;
      } else {
        errors.push(`${rule.name}: ${result.error}`);
      }
    }

    const success = errors.length === 0;
    logAudit(
      "deleteAllRules",
      `Deleted ${deletedCount}/${listResult.rules.length} rules`,
      success,
      errors.length > 0 ? errors.join("; ") : undefined
    );

    return {
      success,
      deletedCount,
      error: errors.length > 0 ? errors.join("; ") : undefined,
    };
  } catch (err: any) {
    const message = err?.message || "Failed to delete all rules";
    logAudit("deleteAllRules", "Failed", false, message);
    return { success: false, deletedCount: 0, error: message };
  }
}

export async function addAllowRule(
  ip: string,
  port: number,
  protocol: "TCP" | "UDP" = "TCP",
  label?: string
): Promise<{ success: boolean; ruleName?: string; error?: string }> {
  if (!isValidIpOrCidr(ip)) {
    return { success: false, error: `Invalid IP or CIDR: ${ip}` };
  }
  if (!isValidPort(port)) {
    return { success: false, error: `Invalid port: ${port}` };
  }

  const safeName = (label || ip).replace(/[^a-zA-Z0-9_.\-\/]/g, "_");
  const ruleName = `${RULE_PREFIX}Allow_${safeName}_${port}_${protocol}`;

  try {
    await runNetsh([
      "advfirewall", "firewall", "add", "rule",
      `name=${ruleName}`, "dir=in", "action=allow",
      `protocol=${protocol}`, `localport=${port}`,
      `remoteip=${ip}`, "enable=yes",
    ]);

    logAudit("addAllowRule", `Added allow rule: ${ruleName} (${ip}:${port}/${protocol})`, true);
    return { success: true, ruleName };
  } catch (err: any) {
    const message = err?.message || "Failed to add allow rule";
    logAudit("addAllowRule", `Failed: ${ruleName}`, false, message);
    return { success: false, error: message };
  }
}

export async function addBlockRule(
  port: number,
  protocol: "TCP" | "UDP" = "TCP"
): Promise<{ success: boolean; ruleName?: string; error?: string }> {
  if (!isValidPort(port)) {
    return { success: false, error: `Invalid port: ${port}` };
  }

  const ruleName = `${RULE_PREFIX}Block_All_${port}_${protocol}`;

  try {
    await runNetsh([
      "advfirewall", "firewall", "add", "rule",
      `name=${ruleName}`, "dir=in", "action=block",
      `protocol=${protocol}`, `localport=${port}`,
      "remoteip=any", "enable=yes",
    ]);

    logAudit("addBlockRule", `Added block rule: ${ruleName} (port ${port}/${protocol})`, true);
    return { success: true, ruleName };
  } catch (err: any) {
    const message = err?.message || "Failed to add block rule";
    logAudit("addBlockRule", `Failed: ${ruleName}`, false, message);
    return { success: false, error: message };
  }
}

export async function addTcpShieldRules(
  port: number,
  protocol: "TCP" | "UDP" = "TCP"
): Promise<{ success: boolean; addedCount: number; error?: string }> {
  if (!isValidPort(port)) {
    return { success: false, addedCount: 0, error: `Invalid port: ${port}` };
  }

  let addedCount = 0;
  const errors: string[] = [];

  for (const ip of TCPSHIELD_IP_RANGES) {
    const result = await addAllowRule(ip, port, protocol, `TCPShield_${ip.replace(/\//g, "_")}`);
    if (result.success) {
      addedCount++;
    } else {
      errors.push(`${ip}: ${result.error}`);
    }
  }

  const success = errors.length === 0;
  logAudit(
    "addTcpShieldRules",
    `Added ${addedCount}/${TCPSHIELD_IP_RANGES.length} TCPShield rules for port ${port}`,
    success,
    errors.length > 0 ? errors.join("; ") : undefined
  );

  return {
    success,
    addedCount,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

export async function tcpShieldLockdown(
  port: number,
  protocol: "TCP" | "UDP" = "TCP"
): Promise<{ success: boolean; error?: string }> {
  if (!isValidPort(port)) {
    return { success: false, error: `Invalid port: ${port}` };
  }

  logAudit("tcpShieldLockdown", `Starting lockdown for port ${port}/${protocol}`, true);

  // Step 1: Save snapshot for rollback
  await saveSnapshot();

  // Step 2: Add allow rules for TCPShield IPs
  const allowResult = await addTcpShieldRules(port, protocol);
  if (!allowResult.success) {
    return { success: false, error: `Failed to add TCPShield allow rules: ${allowResult.error}` };
  }

  // Step 3: Add block rule for all other traffic on this port
  const blockResult = await addBlockRule(port, protocol);
  if (!blockResult.success) {
    return { success: false, error: `Failed to add block rule: ${blockResult.error}` };
  }

  logAudit(
    "tcpShieldLockdown",
    `Lockdown complete for port ${port}/${protocol}: ${allowResult.addedCount} allow rules + 1 block rule`,
    true
  );

  return { success: true };
}

export async function addCustomWhitelistRules(
  ips: string[],
  port: number,
  protocol: "TCP" | "UDP" = "TCP"
): Promise<{ success: boolean; addedCount: number; error?: string }> {
  if (!isValidPort(port)) {
    return { success: false, addedCount: 0, error: `Invalid port: ${port}` };
  }

  const invalidIps = ips.filter((ip) => !isValidIpOrCidr(ip));
  if (invalidIps.length > 0) {
    return { success: false, addedCount: 0, error: `Invalid IPs: ${invalidIps.join(", ")}` };
  }

  let addedCount = 0;
  const errors: string[] = [];

  for (const ip of ips) {
    const result = await addAllowRule(ip, port, protocol, `Custom_${ip.replace(/\//g, "_")}`);
    if (result.success) {
      addedCount++;
    } else {
      errors.push(`${ip}: ${result.error}`);
    }
  }

  const success = errors.length === 0;
  logAudit(
    "addCustomWhitelist",
    `Added ${addedCount}/${ips.length} custom whitelist rules for port ${port}`,
    success,
    errors.length > 0 ? errors.join("; ") : undefined
  );

  return {
    success,
    addedCount,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

// ---- Snapshot / Rollback ----

export async function saveSnapshot(): Promise<{ success: boolean; error?: string }> {
  try {
    const listResult = await listCatalystRules();
    if (!listResult.success) {
      return { success: false, error: listResult.error };
    }

    const snapshot: FirewallRuleSnapshot = {
      timestamp: new Date().toISOString(),
      rules: listResult.rules || [],
    };

    const dir = await ensureDataDir();
    const filePath = join(dir, "snapshot.json");
    await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf-8");

    logAudit("saveSnapshot", `Saved snapshot with ${snapshot.rules.length} rules`, true);
    return { success: true };
  } catch (err: any) {
    const message = err?.message || "Failed to save snapshot";
    logAudit("saveSnapshot", "Failed", false, message);
    return { success: false, error: message };
  }
}

export async function loadSnapshot(): Promise<{
  success: boolean;
  snapshot?: FirewallRuleSnapshot;
  error?: string;
}> {
  try {
    const dir = getDataDir();
    const filePath = join(dir, "snapshot.json");
    const data = await readFile(filePath, "utf-8");
    const snapshot: FirewallRuleSnapshot = JSON.parse(data);

    return { success: true, snapshot };
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return { success: false, error: "No snapshot found" };
    }
    const message = err?.message || "Failed to load snapshot";
    return { success: false, error: message };
  }
}

export async function rollbackToSnapshot(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const snapshotResult = await loadSnapshot();
    if (!snapshotResult.success || !snapshotResult.snapshot) {
      return { success: false, error: snapshotResult.error || "No snapshot available" };
    }

    // Step 1: Delete all current Catalyst rules
    const deleteResult = await deleteAllCatalystRules();
    if (!deleteResult.success) {
      logAudit("rollback", "Warning: some rules could not be deleted during rollback", false, deleteResult.error);
    }

    // Step 2: Re-create rules from snapshot
    const snapshot = snapshotResult.snapshot;
    let restoredCount = 0;
    const errors: string[] = [];

    for (const rule of snapshot.rules) {
      try {
        const args = [
          "advfirewall", "firewall", "add", "rule",
          `name=${rule.name}`,
          `dir=${rule.direction.toLowerCase() === "in" ? "in" : "out"}`,
          `action=${rule.action.toLowerCase()}`,
          `protocol=${rule.protocol}`,
          `localport=${rule.localPort}`,
          `remoteip=${rule.remoteAddress}`,
          `enable=${rule.enabled ? "yes" : "no"}`,
        ];
        await runNetsh(args);
        restoredCount++;
      } catch (err: any) {
        errors.push(`${rule.name}: ${err?.message}`);
      }
    }

    const success = errors.length === 0;
    logAudit(
      "rollback",
      `Restored ${restoredCount}/${snapshot.rules.length} rules from snapshot (${snapshot.timestamp})`,
      success,
      errors.length > 0 ? errors.join("; ") : undefined
    );

    return {
      success,
      error: errors.length > 0 ? `Partially restored. Errors: ${errors.join("; ")}` : undefined,
    };
  } catch (err: any) {
    const message = err?.message || "Rollback failed";
    logAudit("rollback", "Failed", false, message);
    return { success: false, error: message };
  }
}

// ---- Audit & Info ----

export function getAuditLog(): FirewallAuditEntry[] {
  return [...auditLog];
}

export function getTcpShieldIpRanges(): string[] {
  return [...TCPSHIELD_IP_RANGES];
}

export async function isAdmin(): Promise<boolean> {
  return checkAdminPrivileges();
}
