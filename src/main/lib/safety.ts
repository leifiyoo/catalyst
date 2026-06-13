import crypto from "crypto";
import path from "path";

type HashAlgorithm = "sha1" | "sha256" | "sha512";

export function getSafeExternalUrl(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function isPathWithin(targetPath: string, rootPath: string): boolean {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootPath);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

export function resolveSafeServerPath(
  serverRoot: string,
  relativePath: string,
  options: { allowRoot?: boolean } = {}
): string {
  if (relativePath.includes("\0")) {
    throw new Error("Invalid path");
  }

  if (path.isAbsolute(relativePath)) {
    throw new Error("Absolute paths are not allowed");
  }

  const resolvedRoot = path.resolve(serverRoot);
  const resolvedTarget = path.resolve(resolvedRoot, relativePath || ".");

  if (!isPathWithin(resolvedTarget, resolvedRoot)) {
    throw new Error("Path resolves outside the server directory");
  }

  if (!options.allowRoot && resolvedTarget === resolvedRoot) {
    throw new Error("Refusing to operate on the server root");
  }

  return resolvedTarget;
}

export function sanitizeDownloadFileName(fileName: string): string {
  if (!fileName || fileName.includes("\0")) {
    throw new Error("Invalid filename");
  }

  const trimmed = fileName.trim();
  const posixBase = path.posix.basename(trimmed);
  const winBase = path.win32.basename(trimmed);

  if (
    !trimmed ||
    trimmed === "." ||
    trimmed === ".." ||
    posixBase !== trimmed ||
    winBase !== trimmed ||
    trimmed.length > 255
  ) {
    throw new Error("Invalid filename");
  }

  return trimmed;
}

export function verifyBufferHash(
  buffer: Buffer,
  algorithm: HashAlgorithm,
  expectedHash?: string
): boolean {
  if (!expectedHash) return true;

  const expected = expectedHash.trim().toLowerCase();
  if (!expected) return true;

  const actual = crypto.createHash(algorithm).update(buffer).digest("hex");
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}
