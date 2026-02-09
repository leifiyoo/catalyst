/**
 * Backup Worker Thread
 * 
 * This worker runs in a separate thread to prevent UI blocking during backup operations.
 * It handles the CPU-intensive and I/O-heavy task of archiving server directories.
 */

import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

interface WorkerMessage {
  type: 'progress' | 'complete' | 'error' | 'log';
  data: unknown;
}

interface WorkerData {
  serverPath: string;
  backupsDir: string;
  zipPath: string;
  filename: string;
  name: string;
  type: 'manual' | 'auto';
  excludeDir: string;
}

// Helper to send messages to parent thread
function sendMessage(message: WorkerMessage): void {
  if (parentPort) {
    parentPort.postMessage(message);
  }
}

// Helper to get all files to backup (excluding backup directory)
function getFilesToBackup(dirPath: string, excludeDir: string): { path: string; size: number }[] {
  const files: { path: string; size: number }[] = [];
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    
    // Skip the backup directory itself
    if (fullPath === excludeDir || fullPath.startsWith(excludeDir + path.sep)) {
      continue;
    }
    
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      const subFiles = getFilesToBackup(fullPath, excludeDir);
      files.push(...subFiles);
    } else {
      files.push({ path: fullPath, size: stat.size });
    }
  }
  
  return files;
}

async function runBackup(): Promise<void> {
  const { serverPath, backupsDir: _backupsDir, zipPath, filename, name, type, excludeDir } = workerData as WorkerData;
  
  try {
    sendMessage({ 
      type: 'log', 
      data: `[BACKUP_WORKER] Starting backup: ${filename}` 
    });

    // Calculate total size for progress reporting
    sendMessage({ type: 'progress', data: { percent: 0, stage: 'calculating' } });
    
    const filesToBackup = getFilesToBackup(serverPath, excludeDir);
    const totalSize = filesToBackup.reduce((sum, f) => sum + f.size, 0);
    const totalFiles = filesToBackup.length;
    
    sendMessage({ 
      type: 'log', 
      data: `[BACKUP_WORKER] Found ${totalFiles} files to backup (${(totalSize / 1024 / 1024).toFixed(2)} MB)` 
    });

    // Create output stream
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { 
      zlib: { level: 1 },  // Fastest compression
      store: false
    });

    let processedSize = 0;
    let processedFiles = 0;
    let lastProgressUpdate = 0;

    // Track file count manually
    let archivedFiles = 0;
    
    // Set up archive event handlers
    archive.on('progress', (progress) => {
      processedSize = progress.fs.processedBytes;
      
      // Calculate percentage (0-95%, leaving 5% for finalization)
      const percent = totalSize > 0
        ? Math.min(95, Math.round((processedSize / totalSize) * 95))
        : 0;
      
      // Throttle progress updates (every 2%)
      if (percent - lastProgressUpdate >= 2 || percent >= 95) {
        lastProgressUpdate = percent;
        sendMessage({
          type: 'progress',
          data: {
            percent,
            stage: 'archiving',
            processedFiles: archivedFiles,
            totalFiles,
            processedSize,
            totalSize
          }
        });
      }
    });
    
    // Track individual files
    archive.on('entry', (_entry) => {
      archivedFiles++;
    });

    archive.on('warning', (err) => {
      sendMessage({ 
        type: 'log', 
        data: `[BACKUP_WORKER] Warning: ${err.message}` 
      });
    });

    archive.on('error', (err) => {
      sendMessage({ 
        type: 'error', 
        data: { message: err.message, code: err.code } 
      });
    });

    // Set up output stream handlers
    output.on('close', () => {
      const stat = fs.statSync(zipPath);
      
      sendMessage({ 
        type: 'progress', 
        data: { percent: 100, stage: 'complete' } 
      });
      
      sendMessage({ 
        type: 'complete', 
        data: {
          success: true,
          filename,
          path: zipPath,
          size: stat.size,
          name,
          type,
          processedFiles,
          totalFiles
        }
      });
      
      sendMessage({ 
        type: 'log', 
        data: `[BACKUP_WORKER] Backup completed: ${filename} (${(stat.size / 1024 / 1024).toFixed(2)} MB)` 
      });
    });

    output.on('error', (err) => {
      sendMessage({ 
        type: 'error', 
        data: { message: `Output stream error: ${err.message}` } 
      });
    });

    // Pipe archive data to output file
    archive.pipe(output);

    // Add files to archive (skip backup directory)
    sendMessage({ type: 'progress', data: { percent: 5, stage: 'archiving' } });
    
    for (const file of filesToBackup) {
      const relativePath = path.relative(serverPath, file.path);
      archive.file(file.path, { name: relativePath });
    }

    // Finalize the archive
    sendMessage({ 
      type: 'log', 
      data: `[BACKUP_WORKER] Finalizing archive...` 
    });
    
    await archive.finalize();
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    sendMessage({ 
      type: 'error', 
      data: { message: errorMessage } 
    });
    
    sendMessage({ 
      type: 'log', 
      data: `[BACKUP_WORKER] Error: ${errorMessage}` 
    });
    
    // Clean up partial file if it exists
    try {
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
        sendMessage({ 
          type: 'log', 
          data: `[BACKUP_WORKER] Cleaned up partial backup file` 
        });
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Run the backup
runBackup();
