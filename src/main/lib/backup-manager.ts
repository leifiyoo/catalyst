/**
 * Backup Manager - Asynchronous Implementation with Progress Reporting
 * 
 * This module provides backup operations using adm-zip with proper async
 * yielding to prevent UI blocking in Electron.
 */

import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { BackupEntry } from '@shared/types';
import { getServer, updateServerSettings, getServers } from './server-manager';
import { WebContents } from 'electron';

const BACKUP_DIR_NAME = 'backups';

// Backup status tracking for UI updates
interface BackupStatus {
  serverId: string;
  inProgress: boolean;
  percent: number;
  stage: 'idle' | 'calculating' | 'archiving' | 'complete' | 'error';
  error?: string;
}

// Active backups registry to track ongoing backups
const activeBackups = new Map<string, boolean>();
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

/**
 * Yield to the event loop to prevent blocking
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Get all files in a directory recursively (excluding backup directory)
 * Uses async iteration to prevent blocking
 */
async function getAllFilesAsync(
  dirPath: string, 
  excludeDir: string, 
  basePath: string = dirPath
): Promise<{ path: string; relativePath: string; size: number }[]> {
  const files: { path: string; relativePath: string; size: number }[] = [];
  
  if (!fs.existsSync(dirPath)) return files;
  
  const items = fs.readdirSync(dirPath);
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const fullPath = path.join(dirPath, item);
    
    // Skip the backup directory itself
    if (fullPath === excludeDir || fullPath.startsWith(excludeDir + path.sep)) {
      continue;
    }
    
    try {
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        const subFiles = await getAllFilesAsync(fullPath, excludeDir, basePath);
        files.push(...subFiles);
      } else {
        const relativePath = path.relative(basePath, fullPath);
        files.push({ path: fullPath, relativePath, size: stat.size });
      }
    } catch (e) {
      console.warn('[BACKUP] Skipping file due to error:', fullPath, e);
    }
    
    // Yield every 50 items to prevent blocking
    if (i % 50 === 0) {
      await yieldToEventLoop();
    }
  }
  
  return files;
}

/**
 * Create a backup asynchronously using adm-zip
 * 
 * This function properly yields to the event loop to prevent UI blocking
 */
export async function createBackup(
  serverId: string, 
  name?: string, 
  webContents?: WebContents
): Promise<{ success: boolean; error?: string; backup?: BackupEntry; started?: boolean }> {
  console.log('[BACKUP] Entering createBackup function');
  
  // Check if backup is already in progress for this server
  if (activeBackups.has(serverId)) {
    console.log('[BACKUP] Backup already in progress for server:', serverId);
    return { 
      success: false, 
      error: 'A backup is already in progress for this server' 
    };
  }
  
  // Mark as active immediately
  activeBackups.set(serverId, true);
  
  try {
    const server = await getServer(serverId);
    if (!server) {
      console.error('[BACKUP] Server not found', serverId);
      activeBackups.delete(serverId);
      return { success: false, error: 'Server not found' };
    }

    const serverPath = server.serverPath;
    console.log('[BACKUP] Server path:', serverPath);
    
    if (!serverPath || !fs.existsSync(serverPath)) {
      console.error('[BACKUP] Invalid path');
      activeBackups.delete(serverId);
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
    
    console.log('[BACKUP] Target zip path:', zipPath);

    // Initialize status
    backupStatuses.set(serverId, {
      serverId,
      inProgress: true,
      percent: 0,
      stage: 'calculating'
    });

    // Send initial progress
    sendProgress(webContents, serverId, { percent: 0, stage: 'calculating' });

    // Yield before starting heavy work
    await yieldToEventLoop();

    // Get all files to backup (async)
    console.log('[BACKUP] Scanning files...');
    const filesToBackup = await getAllFilesAsync(serverPath, backupsDir);
    const totalFiles = filesToBackup.length;
    const totalSize = filesToBackup.reduce((sum, f) => sum + f.size, 0);
    
    console.log(`[BACKUP] Found ${totalFiles} files to backup (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);

    if (totalFiles === 0) {
      console.error('[BACKUP] No files to backup');
      activeBackups.delete(serverId);
      backupStatuses.delete(serverId);
      return { success: false, error: 'No files found to backup' };
    }

    // Update stage to archiving
    sendProgress(webContents, serverId, { percent: 5, stage: 'archiving' });

    // Create zip file
    const zip = new AdmZip();
    let processedFiles = 0;

    // Add files in batches to prevent blocking
    const BATCH_SIZE = 20;
    
    for (let i = 0; i < filesToBackup.length; i += BATCH_SIZE) {
      const batch = filesToBackup.slice(i, i + BATCH_SIZE);
      
      for (const file of batch) {
        try {
          zip.addLocalFile(file.path, path.dirname(file.relativePath));
          processedFiles++;
        } catch (e) {
          console.warn('[BACKUP] Failed to add file to backup:', file.path, e);
        }
      }
      
      // Calculate progress (5-95% range for archiving)
      const percent = Math.min(95, Math.round(5 + (processedFiles / totalFiles) * 90));
      
      // Send progress update
      sendProgress(webContents, serverId, {
        percent,
        stage: 'archiving',
        processedFiles,
        totalFiles
      });
      
      // Yield to event loop after each batch
      await yieldToEventLoop();
    }

    // Write zip file (95-100%)
    sendProgress(webContents, serverId, { percent: 95, stage: 'complete' });
    
    // Yield before writing
    await yieldToEventLoop();
    
    console.log('[BACKUP] Writing zip file...');
    zip.writeZip(zipPath);
    
    // Verify the file was created
    if (!fs.existsSync(zipPath)) {
      console.error('[BACKUP] Zip file was not created');
      activeBackups.delete(serverId);
      backupStatuses.delete(serverId);
      return { success: false, error: 'Failed to create backup file' };
    }

    const stat = fs.statSync(zipPath);
    console.log(`[BACKUP] Backup created: ${filename} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

    // Clean up status
    activeBackups.delete(serverId);
    backupStatuses.delete(serverId);

    // Send final progress
    sendProgress(webContents, serverId, { percent: 100, stage: 'complete' });

    // Send completion event
    if (webContents && !webContents.isDestroyed()) {
      const backupEntry: BackupEntry = {
        name: name || 'Automatic Backup',
        filename,
        path: zipPath,
        size: stat.size,
        createdAt: new Date().toISOString(),
        type: name ? 'manual' : 'auto'
      };
      
      webContents.send('rendererLog', { 
        message: 'Backup completed', 
        data: { filename, size: stat.size } 
      });
      
      // Send backup list refresh trigger
      webContents.send('backupCompleted', { serverId, backup: backupEntry });
    }

    return { 
      success: true, 
      started: true,
      backup: {
        name: name || 'Automatic Backup',
        filename,
        path: zipPath,
        size: stat.size,
        createdAt: new Date().toISOString(),
        type: name ? 'manual' : 'auto'
      }
    };

  } catch (error) {
    console.error('[BACKUP] Fatal error:', error);
    activeBackups.delete(serverId);
    backupStatuses.delete(serverId);
    
    // Send error to UI
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
  if (activeBackups.has(serverId)) {
    console.log('[BACKUP] Cancelling backup for server:', serverId);
    activeBackups.delete(serverId);
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
            await createBackup(server.id);
            
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
