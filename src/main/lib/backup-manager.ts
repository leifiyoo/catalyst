/**
 * Backup Manager - Asynchronous Implementation with Progress Reporting
 * 
 * This module provides backup operations using adm-zip with proper async
 * yielding to prevent UI blocking in Electron.
 */

import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { Worker } from 'worker_threads';
import { BackupEntry } from '@shared/types';
import { getServer, updateServerSettings, getServers } from './server-manager';
import { WebContents } from 'electron';
import { isRunning } from './server-runner';
import { isPathWithin, sanitizeDownloadFileName } from './safety';

const BACKUP_DIR_NAME = 'backups';

// Backup status tracking for UI updates
interface BackupStatus {
  serverId: string;
  inProgress: boolean;
  percent: number;
  stage: 'idle' | 'calculating' | 'archiving' | 'complete' | 'error';
  error?: string;
}

type ActiveBackup = {
  worker: Worker;
  zipPath: string;
  webContents?: WebContents;
  cancelled: boolean;
};

// Active backups registry to track ongoing backups
const activeBackups = new Map<string, ActiveBackup>();
const backupStatuses = new Map<string, BackupStatus>();

/**
 * Send progress update to the renderer process
 */
function sendProgress(webContents: WebContents | undefined, serverId: string, data: {
  percent: number;
  stage?: string;
  processedFiles?: number;
  totalFiles?: number;
}): void {
  if (webContents && !webContents.isDestroyed()) {
    webContents.send('backupProgress', {
      serverId,
      percent: data.percent,
      stage: data.stage,
      processedFiles: data.processedFiles,
      totalFiles: data.totalFiles
    });
  }
  
  // Update local status
  const status = backupStatuses.get(serverId);
  if (status) {
    status.percent = data.percent;
    if (data.stage) {
      status.stage = data.stage as BackupStatus['stage'];
    }
  }
}

export async function createBackup(
  serverId: string, 
  name?: string, 
  webContents?: WebContents
): Promise<{ success: boolean; error?: string; backup?: BackupEntry; started?: boolean }> {
  if (activeBackups.has(serverId)) {
    return { 
      success: false, 
      error: 'A backup is already in progress for this server' 
    };
  }

  try {
    const server = await getServer(serverId);
    if (!server) {
      return { success: false, error: 'Server not found' };
    }

    const serverPath = server.serverPath;
    if (!serverPath || !fs.existsSync(serverPath)) {
      return { success: false, error: 'Server path is invalid or missing' };
    }

    const backupsDir = path.join(serverPath, BACKUP_DIR_NAME);
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = name ? name.replace(/[^a-zA-Z0-9-_]/g, '_') : 'auto';
    const filename = `backup-${timestamp}-${safeName}.zip`;
    const zipPath = path.join(backupsDir, filename);

    backupStatuses.set(serverId, {
      serverId,
      inProgress: true,
      percent: 0,
      stage: 'calculating'
    });

    sendProgress(webContents, serverId, { percent: 0, stage: 'calculating' });

    return await new Promise((resolve) => {
      let settled = false;
      const worker = new Worker(path.join(__dirname, 'backup-worker.js'), {
        workerData: {
          serverPath,
          backupsDir,
          zipPath,
          filename,
          name: name || 'Automatic Backup',
          type: name ? 'manual' : 'auto',
          excludeDir: backupsDir
        }
      });

      activeBackups.set(serverId, { worker, zipPath, webContents, cancelled: false });

      const settle = async (result: { success: boolean; error?: string; backup?: BackupEntry; started?: boolean }) => {
        if (settled) return;
        settled = true;
        activeBackups.delete(serverId);
        backupStatuses.delete(serverId);
        if (!result.success) {
          await fs.promises.rm(zipPath, { force: true }).catch(() => {});
        }
        resolve(result);
      };

      worker.on('message', (message: { type: string; data: any }) => {
        if (message.type === 'progress') {
          sendProgress(webContents, serverId, {
            percent: message.data.percent,
            stage: message.data.stage,
            processedFiles: message.data.processedFiles,
            totalFiles: message.data.totalFiles
          });
          return;
        }

        if (message.type === 'log') {
          console.log(message.data);
          return;
        }

        if (message.type === 'error') {
          const errorMessage = message.data?.message ?? 'Backup failed';
          if (webContents && !webContents.isDestroyed()) {
            webContents.send('backupProgress', { serverId, percent: -1, error: errorMessage });
          }
          void settle({ success: false, error: errorMessage });
          return;
        }

        if (message.type === 'complete') {
          const backup: BackupEntry = {
            name: name || 'Automatic Backup',
            filename,
            path: zipPath,
            size: message.data.size,
            createdAt: new Date().toISOString(),
            type: name ? 'manual' : 'auto'
          };

          if (webContents && !webContents.isDestroyed()) {
            webContents.send('rendererLog', {
              message: 'Backup completed',
              data: { filename, size: message.data.size }
            });
            webContents.send('backupCompleted', { serverId, backup });
          }

          void settle({ success: true, started: true, backup });
        }
      });

      worker.on('error', (error) => {
        void settle({ success: false, error: error.message });
      });

      worker.on('exit', (code) => {
        if (settled) return;
        const active = activeBackups.get(serverId);
        if (active?.cancelled) {
          void settle({ success: false, error: 'Backup cancelled' });
          return;
        }
        if (code !== 0) {
          void settle({ success: false, error: `Backup worker exited with code ${code}` });
        }
      });
    });

  } catch (error) {
    activeBackups.delete(serverId);
    backupStatuses.delete(serverId);

    const errorMessage = error instanceof Error ? error.message : String(error);
    if (webContents && !webContents.isDestroyed()) {
      webContents.send('backupProgress', { 
        serverId, 
        percent: -1, 
        error: errorMessage 
      });
    }
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Cancel an ongoing backup
 */
export function cancelBackup(serverId: string): boolean {
  const active = activeBackups.get(serverId);
  if (active) {
    active.cancelled = true;
    void active.worker.terminate().finally(() => {
      fs.rmSync(active.zipPath, { force: true });
    });
    if (active.webContents && !active.webContents.isDestroyed()) {
      active.webContents.send('backupProgress', {
        serverId,
        percent: -1,
        error: 'Backup cancelled'
      });
    }
    return true;
  }
  return false;
}

/**
 * Get the current backup status for a server
 */
export function getBackupStatus(serverId: string): BackupStatus | undefined {
  return backupStatuses.get(serverId);
}

/**
 * Check if a backup is in progress for a server
 */
export function isBackupInProgress(serverId: string): boolean {
  return activeBackups.has(serverId);
}

export async function getBackups(serverId: string): Promise<BackupEntry[]> {
  const server = await getServer(serverId);
  if (!server) return [];

  const backupsDir = path.join(server.serverPath, BACKUP_DIR_NAME);
  if (!fs.existsSync(backupsDir)) return [];

  const files = fs.readdirSync(backupsDir);
  const backups: BackupEntry[] = [];

  for (const file of files) {
    if (!file.endsWith('.zip')) continue;
    try {
      const filePath = path.join(backupsDir, file);
      const stat = fs.statSync(filePath);

      let type: 'manual' | 'auto' = 'manual';
      let name = file;

      // Filename format: backup-<timestamp>-<name>.zip
      // or backup-<timestamp>-auto.zip
      if (file.includes('-auto.zip')) {
        type = 'auto';
        name = 'Automatic Backup';
      } else {
        // Remove prefix and extension to get name
        const prefix = 'backup-';
        if (file.startsWith(prefix)) {
          const rest = file.substring(prefix.length);
          const namePart = rest.substring(rest.indexOf('-', 20) + 1).replace('.zip', '');
          name = namePart; 
        }
      }
      
      // Clean up name underscores
      name = name.replace(/_/g, ' ');

      backups.push({
        name,
        filename: file,
        path: filePath,
        size: stat.size,
        createdAt: stat.birthtime.toISOString(),
        type
      });
    } catch (e) {
      console.warn('[BACKUP] Error reading backup file:', file, e);
    }
  }

  return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function deleteBackup(serverId: string, filename: string): Promise<{ success: boolean; error?: string }> {
  const server = await getServer(serverId);
  if (!server) return { success: false, error: 'Server not found' };

  let safeFilename: string;
  try {
    safeFilename = sanitizeDownloadFileName(filename);
  } catch {
    return { success: false, error: 'Invalid filename' };
  }

  const backupsDir = path.join(server.serverPath, BACKUP_DIR_NAME);
  const filePath = path.join(backupsDir, safeFilename);

  // Double-check resolved path is within backups directory
  const resolvedPath = path.resolve(filePath);
  const resolvedBackupsDir = path.resolve(backupsDir);
  if (!isPathWithin(resolvedPath, resolvedBackupsDir) || resolvedPath === resolvedBackupsDir) {
    return { success: false, error: 'Access denied' };
  }

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    }
    return { success: false, error: 'File not found' };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

export async function restoreBackup(serverId: string, filename: string): Promise<{ success: boolean; error?: string }> {
  const server = await getServer(serverId);
  if (!server) return { success: false, error: 'Server not found' };

  if (isRunning(serverId)) {
    return { success: false, error: 'Stop the server before restoring a backup' };
  }

  let safeFilename: string;
  try {
    safeFilename = sanitizeDownloadFileName(filename);
  } catch {
    return { success: false, error: 'Invalid filename' };
  }

  const backupsDir = path.join(server.serverPath, BACKUP_DIR_NAME);
  const zipPath = path.join(backupsDir, safeFilename);
  const serverPath = server.serverPath;

  // Double-check resolved path is within backups directory
  const resolvedZipPath = path.resolve(zipPath);
  const resolvedBackupsDir = path.resolve(backupsDir);
  if (!isPathWithin(resolvedZipPath, resolvedBackupsDir) || resolvedZipPath === resolvedBackupsDir) {
    return { success: false, error: 'Access denied' };
  }

  if (!fs.existsSync(zipPath)) return { success: false, error: 'Backup file not found' };

  try {
    const zip = new AdmZip(zipPath);
    
    // Validate zip entries for path traversal (zip slip protection)
    const resolvedServerPath = path.resolve(serverPath);
    for (const entry of zip.getEntries()) {
      const entryPath = path.resolve(serverPath, entry.entryName);
      if (!isPathWithin(entryPath, resolvedServerPath)) {
        return { success: false, error: `Malicious zip entry detected: ${entry.entryName}` };
      }
    }

    // Careful deletion
    const currentFiles = fs.readdirSync(serverPath);
    for (const file of currentFiles) {
      const fullPath = path.join(serverPath, file);
      if (path.resolve(fullPath) === path.resolve(backupsDir)) continue;
      await fs.promises.rm(fullPath, { recursive: true, force: true });
    }

    zip.extractAllTo(serverPath, true);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

export async function checkAndRunAutoBackups() {
  try {
    const servers = await getServers();
    for (const server of servers) {
      if (server.backupConfig?.enabled) {
        const lastBackup = server.backupConfig.lastBackupAt ? new Date(server.backupConfig.lastBackupAt).getTime() : 0;
        const intervalMs = server.backupConfig.intervalHours * 60 * 60 * 1000;
        const now = Date.now();

        if (now - lastBackup > intervalMs) {
          if (!isBackupInProgress(server.id)) {
            console.log(`[AUTO_BACKUP] Running auto backup for server ${server.name}`);
            const result = await createBackup(server.id);
            if (result.success) {
              await updateServerSettings(server.id, {
                backupConfig: {
                  ...server.backupConfig,
                  lastBackupAt: new Date().toISOString()
                }
              });
            } else {
              console.warn(`[AUTO_BACKUP] Backup failed for ${server.name}: ${result.error}`);
            }
          } else {
            console.log(`[AUTO_BACKUP] Skipping auto backup for ${server.name} - backup already in progress`);
          }
        }
      }
    }
  } catch (error) {
    console.error("[AUTO_BACKUP] Error checking auto backups:", error);
  }
}
