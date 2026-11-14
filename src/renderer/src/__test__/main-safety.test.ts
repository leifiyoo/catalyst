import path from "path";

import { describe, expect, test } from "vitest";

import {
  getSafeExternalUrl,
  resolveSafeServerPath,
  sanitizeDownloadFileName,
  verifyBufferHash,
} from "../../../main/lib/safety";

describe("main process safety helpers", () => {
  test("allows only http and https external URLs", () => {
    expect(getSafeExternalUrl("https://example.com/docs")).toBe("https://example.com/docs");
    expect(getSafeExternalUrl("http://localhost:3000")).toBe("http://localhost:3000/");

    expect(getSafeExternalUrl("file:///C:/Windows/System32/calc.exe")).toBeNull();
    expect(getSafeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(getSafeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(getSafeExternalUrl("not a url")).toBeNull();
  });

  test("resolves relative server paths without allowing root, absolute, or traversal targets", () => {
    const root = path.resolve("C:/servers/example");

    expect(resolveSafeServerPath(root, "world/level.dat")).toBe(path.join(root, "world", "level.dat"));
    expect(resolveSafeServerPath(root, "world", { allowRoot: false })).toBe(path.join(root, "world"));
    expect(resolveSafeServerPath(root, "", { allowRoot: true })).toBe(root);

    expect(() => resolveSafeServerPath(root, "")).toThrow(/root/i);
    expect(() => resolveSafeServerPath(root, ".")).toThrow(/root/i);
    expect(() => resolveSafeServerPath(root, "..")).toThrow(/outside/i);
    expect(() => resolveSafeServerPath(root, "../outside")).toThrow(/outside/i);
    expect(() => resolveSafeServerPath(root, "C:/outside")).toThrow(/absolute/i);
  });

  test("accepts only plain download filenames", () => {
    expect(sanitizeDownloadFileName("Plugin-1.0.0.jar")).toBe("Plugin-1.0.0.jar");

    expect(() => sanitizeDownloadFileName("")).toThrow(/filename/i);
    expect(() => sanitizeDownloadFileName(".")).toThrow(/filename/i);
    expect(() => sanitizeDownloadFileName("../Plugin.jar")).toThrow(/filename/i);
    expect(() => sanitizeDownloadFileName("plugins/Plugin.jar")).toThrow(/filename/i);
    expect(() => sanitizeDownloadFileName("C:/temp/Plugin.jar")).toThrow(/filename/i);
  });

  test("verifies expected download hashes", () => {
    const content = Buffer.from("hello");

    expect(verifyBufferHash(content, "sha1", "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d")).toBe(true);
    expect(verifyBufferHash(content, "sha1", "0000000000000000000000000000000000000000")).toBe(false);
    expect(verifyBufferHash(content, "sha512", undefined)).toBe(true);
  });
});
