/**
 * Backup Manager - Worker Thread Implementation
 * 
 * This module provides non-blocking backup operations by utilizing Node.js Worker Threads.
 * All CPU-intensive and I/O-heavy operations run in separate threads to maintain UI responsiveness.
 */

import fs from 'fs';
import path from 'path';
import { Worker } from 'worker_threads';
import AdmZip from 'adm-zip';
import { BackupEntry } from '@shared/types';
import { getServer, updateServerSettings, getServers } from './server-manager';
import { WebContents } from 'electron';

const BACKUP_DIR_NAME = 'backups';

// Active workers registry to track ongoing backups
const activeWorkers = new Map<string, Worker>();

// Backup status tracking for UI updates
interface BackupStatus {
  serverId: string;
  inProgress: boolean;
  percent: number;
  stage: 'idle' | 'calculating' | 'archiving' | 'complete' | 'error';
  error?: string;
}

const backupStatuses = new Map<string, BackupStatus>();

/**
 * Get the path to the worker script (handles both dev and production)
 */
function getWorkerScriptPath(): string {
  // In development, use the TypeScript file directly via ts-node/esm loader
  // In production, use the compiled JavaScript file
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  
  if (isDev) {
    return path.join(__dirname, 'backup-worker.ts');
  }
  
  // In production, worker should be in the same directory
  return path.join(__dirname, 'backup-worker.js');
}

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

/**
 * Create a backup using a Worker Thread (non-blocking)
 * 
 * This function returns immediately with a status object. The actual backup runs
 * asynchronously in a worker thread. Progress updates are sent via IPC events.
 */
export async function createBackup(
  serverId: string, 
  name?: string, 
  webContents?: WebContents
): Promise<{ success: boolean; error?: string; backup?: BackupEntry; started?: boolean }> {
  console.log('[BACKUP_DEBUG] Entering createBackup function');
  
  try {
    // Check if backup is already in progress for this server
    if (activeWorkers.has(serverId)) {
      console.log('[BACKUP_DEBUG] Backup already in progress for server:', serverId);
      return { 
        success: false, 
        error: 'A backup is already in progress for this server' 
      };
    }
    
    const server = await getServer(serverId);
    if (!server) {
      console.error('[BACKUP_DEBUG] Server not found', serverId);
      return { success: false, error: 'Server not found' };
    }

    const serverPath = server.serverPath;
    console.log('[BACKUP_DEBUG] Server path:', serverPath);
    
    if (!serverPath || !fs.existsSync(serverPath)) {
      console.error('[BACKUP_DEBUG] Invalid path');
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
    
    console.log('[BACKUP_DEBUG] Target zip path:', zipPath);

    // Initialize status
    backupStatuses.set(serverId, {
      serverId,
      inProgress: true,
      percent: 0,
      stage: 'calculating'
    });

    // Send initial progress
    sendProgress(webContents, serverId, { percent: 0, stage: 'calculating' });

    // Create and configure worker
    const workerPath = getWorkerScriptPath();
    console.log('[BACKUP_DEBUG] Starting worker:', workerPath);

    const worker = new Worker(workerPath, {
      workerData: {
        serverPath,
        backupsDir,
        zipPath,
        filename,
        name: name || 'Automatic Backup',
        type: name ? 'manual' : 'auto',
        excludeDir: backupsDir
      },
      // In development, we need to use ts-node/esm loader
      execArgv: process.env.NODE_ENV === 'development' ? ['--loader', 'ts-node/esm'] : undefined
    });

    // Store worker reference
    activeWorkers.set(serverId, worker);

    // Set up message handlers
    worker.on('message', (message: { type: string; data: unknown }) => {
      switch (message.type) {
        case 'progress': {
          const progressData = message.data as {
            percent: number;
            stage: string;
            processedFiles?: number;
            totalFiles?: number;
          };
          sendProgress(webContents, serverId, progressData);
          break;
        }
        
        case 'complete': {
          const result = message.data as {
            success: boolean;
            filename: string;
            path: string;
            size: number;
            name: string;
            type: 'manual' | 'auto';
          };
          
          console.log('[BACKUP_DEBUG] Worker completed:', result);
          
          // Clean up
          activeWorkers.delete(serverId);
          backupStatuses.delete(serverId);
          
          // Send final progress
          sendProgress(webContents, serverId, { percent: 100, stage: 'complete' });
          
          // Send completion log
          if (webContents && !webContents.isDestroyed()) {
            webContents.send('rendererLog', { 
              message: 'Backup completed', 
              data: { filename: result.filename, size: result.size } 
            });
            
            // Send backup list refresh trigger
            webContents.send('backupCompleted', { serverId, backup: result });
          }
          break;
        }
        
        case 'error': {
          const errorData = message.data as { message: string; code?: string };
          console.error('[BACKUP_DEBUG] Worker error:', errorData);
          
          // Clean up
          activeWorkers.delete(serverId);
          const status = backupStatuses.get(serverId);
          if (status) {
            status.inProgress = false;
            status.stage = 'error';
            status.error = errorData.message;
          }
          
          // Send error to UI
          if (webContents && !webContents.isDestroyed()) {
            webContents.send('backupProgress', { serverId, percent: -1, error: errorData.message });
            webContents.send('rendererLog', { 
              message: 'Backup error', 
              data: { error: errorData.message } 
            });
          }
          break;
        }
        
        case 'log': {
          console.log(message.data);
          break;
        }
      }
    });

    worker.on('error', (error) => {
      console.error('[BACKUP_DEBUG] Worker thread error:', error);
      activeWorkers.delete(serverId);
      backupStatuses.delete(serverId);
      
      if (webContents && !webContents.isDestroyed()) {
        webContents.send('backupProgress', { 
          serverId, 
          percent: -1, 
          error: error.message 
        });
      }
    });

    worker.on('exit', (code) => {
      console.log('[BACKUP_DEBUG] Worker exited with code:', code);
      activeWorkers.delete(serverId);
      
      if (code !== 0) {
        console.error('[BACKUP_DEBUG] Worker stopped with exit code', code);
        backupStatuses.delete(serverId);
      }
    });

    // Return immediately - backup is running in background
    return { 
      success: true, 
      started: true 
    };

  } catch (error) {
    console.error('[BACKUP_DEBUG] Fatal error:', error);
    activeWorkers.delete(serverId);
    backupStatuses.delete(serverId);
    return { success: false, error: String(error) };
  }
}

/**
 * Cancel an ongoing backup
 */
export function cancelBackup(serverId: string): boolean {
  const worker = activeWorkers.get(serverId);
  if (worker) {
    console.log('[BACKUP_DEBUG] Cancelling backup for server:', serverId);
    worker.terminate();
    activeWorkers.delete(serverId);
    backupStatuses.delete(serverId);
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
  return activeWorkers.has(serverId);
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
        // backup-2023-10-10...-name.zip
        // Find second dash? No, timestamp has dashes.
        // Regex might be better.
        // Assuming format `backup-{timestamp}-{name}.zip`
        const parts = file.split('-');
        if (parts.length > 5) {
          // timestamp is roughly 2023-01-01T12-00-00-000Z (many dashes)
          // Let's just use the file name as display name if we can't parse perfectly
          // Or strip existing prefix
          const prefix = 'backup-';
          if (file.startsWith(prefix)) {
            const rest = file.substring(prefix.length); // timestamp-name.zip
            // timestamp ends with Z or matches ISO-ish
            // this is hard to parse reliably without metadata.
            // Simplified:
            const namePart = rest.substring(rest.indexOf('-', 20) + 1).replace('.zip', ''); // 20 chars for timestamp min
             name = namePart; 
          }
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
    } catch (e) {}
  }

  return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function deleteBackup(serverId: string, filename: string): Promise<{ success: boolean; error?: string }> {
  const server = await getServer(serverId);
  if (!server) return { success: false, error: 'Server not found' };

  const backupsDir = path.join(server.serverPath, BACKUP_DIR_NAME);
  const filePath = path.join(backupsDir, filename);

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

  const backupsDir = path.join(server.serverPath, BACKUP_DIR_NAME);
  const zipPath = path.join(backupsDir, filename);
  const serverPath = server.serverPath;

  if (!fs.existsSync(zipPath)) return { success: false, error: 'Backup file not found' };

  try {
    const zip = new AdmZip(zipPath);
    
    // Careful deletion
    const currentFiles = fs.readdirSync(serverPath);
    for (const file of currentFiles) {
      const fullPath = path.join(serverPath, file);
      if (fullPath === backupsDir) continue;
      // Maybe keep logs? No, restore usually implies full state rollback.
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
          // Check if backup is already in progress
          if (!isBackupInProgress(server.id)) {
            console.log(`[AUTO_BACKUP] Running auto backup for server ${server.name}`);
            // For auto-backups, we don't have webContents, so progress won't be shown
            // But the backup will still run in a worker thread
            await createBackup(server.id);
            
            // Update last backup time
            await updateServerSettings(server.id, {
              backupConfig: {
                ...server.backupConfig,
                lastBackupAt: new Date().toISOString()
              }
            });
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
