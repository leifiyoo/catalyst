/**
 * File Streaming Module
 * 
 * Handles streaming read/write for large files (>2MB) in Catalyst.
 * Supports chunked reading with pagination and efficient write-back.
 */

import fs from "fs/promises";
import { createReadStream, createWriteStream } from "fs";
import path from "path";

const CHUNK_SIZE = 256 * 1024; // 256 KB chunks for streaming reads
const MAX_STREAMED_FILE_SIZE = 100 * 1024 * 1024; // 100 MB max for streaming mode

export interface StreamingFileReadResult {
  success: boolean;
  content?: string;
  totalLines?: number;
  hasMoreLines?: boolean;
  startLine?: number;
  endLine?: number;
  error?: string;
}

export interface StreamingFileWriteResult {
  success: boolean;
  bytesWritten?: number;
  error?: string;
}

export interface FileMetadata {
  size: number;
  lineCount: number;
  estimatedChunks: number;
}

/**
 * Count the number of lines in a file without loading entire file into memory.
 * Useful for large files to determine pagination needs.
 */
export async function countFileLines(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let lineCount = 0;
    let lastWasNewline = true;

    const stream = createReadStream(filePath, { encoding: "utf8" });
    let buffer = "";

    stream.on("data", (chunk: string) => {
      buffer += chunk;
      const newlines = buffer.match(/\n/g);
      if (newlines) {
        lineCount += newlines.length;
        lastWasNewline = buffer[buffer.length - 1] === "\n";
      }
    });

    stream.on("end", () => {
      // If last character wasn't a newline, increment count for final line
      if (buffer.length > 0 && !lastWasNewline) {
        lineCount++;
      }
      resolve(lineCount);
    });

    stream.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Get metadata about a file (size, line count, estimated chunks needed).
 */
export async function getFileMetadata(filePath: string): Promise<FileMetadata> {
  try {
    const stat = await fs.stat(filePath);
    const lineCount = await countFileLines(filePath);
    const estimatedChunks = Math.ceil(stat.size / CHUNK_SIZE);

    return {
      size: stat.size,
      lineCount,
      estimatedChunks,
    };
  } catch (err) {
    throw new Error(`Failed to get file metadata: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Stream-read a file starting from a specific line number.
 * Returns up to maxLines from the file.
 * 
 * @param filePath Path to the file
 * @param startLine Line number to start from (0-indexed)
 * @param maxLines Maximum number of lines to read (default: 500)
 * @returns Streaming read result with content and pagination info
 */
export async function streamReadFile(
  filePath: string,
  startLine: number = 0,
  maxLines: number = 500
): Promise<StreamingFileReadResult> {
  try {
    // First, check if file exists and get its size
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      return { success: false, error: "Cannot read a directory" };
    }

    // For small files, just read normally (faster)
    if (stat.size <= 2 * 1024 * 1024) {
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");
      const totalLines = lines.length;

      // Handle pagination
      const endLine = Math.min(startLine + maxLines, totalLines);
      const paginatedContent = lines.slice(startLine, endLine).join("\n");

      return {
        success: true,
        content: paginatedContent,
        totalLines,
        hasMoreLines: endLine < totalLines,
        startLine,
        endLine,
      };
    }

    // For large files, use streaming
    return new Promise((resolve) => {
      let currentLine = 0;
      let collectedLines: string[] = [];
      let buffer = "";
      let totalLines = 0;
      let stream: NodeJS.ReadableStream | null = null;

      // First pass: count total lines and find the starting position
      stream = createReadStream(filePath, { encoding: "utf8" });

      stream.on("data", (chunk: string) => {
        const newlines = chunk.match(/\n/g);
        if (newlines) {
          totalLines += newlines.length;
        }
      });

      stream.on("end", () => {
        // Second pass: read the requested lines
        if (!buffer && collectedLines.length === 0) {
          // If we haven't started reading yet, do it now
          readRequestedLines();
        }
      });

      stream.on("error", (err) => {
        resolve({
          success: false,
          error: `Failed to read file: ${err.message}`,
        });
      });

      function readRequestedLines() {
        currentLine = 0;
        collectedLines = [];
        buffer = "";

        const readStream = createReadStream(filePath, { encoding: "utf8" });
        let skipMode = startLine > 0;
        let linesSeen = 0;

        readStream.on("data", (chunk: string) => {
          buffer += chunk;
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep last incomplete line in buffer

          for (const line of lines) {
            if (skipMode) {
              if (linesSeen >= startLine) {
                skipMode = false;
                collectedLines.push(line);
              }
              linesSeen++;
            } else if (collectedLines.length < maxLines) {
              collectedLines.push(line);
            } else {
              // We have enough lines, pause the stream
              readStream.pause();
              return;
            }
          }
        });

        readStream.on("end", () => {
          // Add any remaining content in buffer
          if (buffer.length > 0 && collectedLines.length < maxLines) {
            collectedLines.push(buffer);
          }

          const content = collectedLines.join("\n");
          resolve({
            success: true,
            content,
            totalLines,
            hasMoreLines: startLine + collectedLines.length < totalLines,
            startLine,
            endLine: startLine + collectedLines.length,
          });
        });

        readStream.on("error", (err) => {
          resolve({
            success: false,
            error: `Failed to read file: ${err.message}`,
          });
        });
      }
    });
  } catch (err) {
    return {
      success: false,
      error: `Error reading file: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Stream-write content to a file in chunks.
 * Useful for writing large amounts of data without loading everything into memory.
 * 
 * @param filePath Path to the file
 * @param content Content to write
 * @param append If true, append to existing file; if false, overwrite
 * @returns Write result with bytes written info
 */
export async function streamWriteFile(
  filePath: string,
  content: string,
  append: boolean = false
): Promise<StreamingFileWriteResult> {
  try {
    // For reasonable-sized writes, just use normal write
    if (content.length <= 5 * 1024 * 1024) {
      const flags = append ? "a" : "w";
      await fs.writeFile(filePath, content, { flag: flags, encoding: "utf-8" });
      return {
        success: true,
        bytesWritten: Buffer.byteLength(content, "utf-8"),
      };
    }

    // For very large writes, use streaming to reduce memory pressure
    return new Promise((resolve) => {
      const flags = append ? "a" : "w";
      const writeStream = createWriteStream(filePath, { flags, encoding: "utf-8" });

      let bytesWritten = 0;
      const chunkSize = CHUNK_SIZE;
      let offset = 0;

      writeStream.on("finish", () => {
        resolve({
          success: true,
          bytesWritten,
        });
      });

      writeStream.on("error", (err) => {
        resolve({
          success: false,
          error: `Failed to write file: ${err.message}`,
        });
      });

      // Write in chunks
      const writeChunk = () => {
        if (offset >= content.length) {
          writeStream.end();
          return;
        }

        const chunk = content.slice(offset, offset + chunkSize);
        const canContinue = writeStream.write(chunk);
        bytesWritten += Buffer.byteLength(chunk, "utf-8");
        offset += chunkSize;

        if (canContinue) {
          setImmediate(writeChunk);
        } else {
          writeStream.once("drain", writeChunk);
        }
      };

      writeChunk();
    });
  } catch (err) {
    return {
      success: false,
      error: `Error writing file: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Efficiently read and modify a large file line-by-line.
 * Passes each line to a transform function and writes results back.
 * 
 * @param filePath Path to the file
 * @param transformFn Function that transforms each line
 * @returns Result with number of lines processed
 */
export async function transformFile(
  filePath: string,
  transformFn: (line: string, lineNum: number) => string
): Promise<{ success: boolean; linesProcessed?: number; error?: string }> {
  try {
    return new Promise((resolve) => {
      const tempPath = `${filePath}.tmp`;
      let linesProcessed = 0;
      let buffer = "";

      const readStream = createReadStream(filePath, { encoding: "utf8" });
      const writeStream = createWriteStream(tempPath, { encoding: "utf8" });

      readStream.on("data", (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const transformed = transformFn(line, linesProcessed++);
          writeStream.write(transformed + "\n");
        }
      });

      readStream.on("end", () => {
        // Process any remaining content in buffer
        if (buffer.length > 0) {
          const transformed = transformFn(buffer, linesProcessed++);
          writeStream.write(transformed);
        }
        writeStream.end();
      });

      writeStream.on("finish", async () => {
        try {
          // Atomic replace: rename temp to original
          await fs.rename(tempPath, filePath);
          resolve({
            success: true,
            linesProcessed,
          });
        } catch (err) {
          // Clean up temp file if rename fails
          await fs.unlink(tempPath).catch(() => {});
          resolve({
            success: false,
            error: `Failed to save file: ${err instanceof Error ? err.message : String(err)}`
          });
        }
      });

      readStream.on("error", (err) => {
        writeStream.destroy();
        fs.unlink(tempPath).catch(() => {});
        resolve({
          success: false,
          error: `Read error: ${err.message}`,
        });
      });

      writeStream.on("error", (err) => {
        readStream.destroy();
        fs.unlink(tempPath).catch(() => {});
        resolve({
          success: false,
          error: `Write error: ${err.message}`,
        });
      });
    });
  } catch (err) {
    return {
      success: false,
      error: `Error transforming file: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
