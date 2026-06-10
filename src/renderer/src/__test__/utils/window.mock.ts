import { vi } from "vitest";

const context = Object.defineProperty(window, "context", {
  writable: true,
  value: {
    getVersions: vi.fn().mockImplementation(() => ({
      electron: "0.0",
      chrome: "0.0",
      node: "0.0",
    })),
    appReady: vi.fn().mockImplementation(() => new Promise(() => {})),
    setAlwaysOnTop: vi.fn().mockResolvedValue(undefined),
    resizeWindow: vi.fn().mockResolvedValue(undefined),
    getWindowState: vi.fn().mockResolvedValue({ isMaximized: false }),
    onResizeStep: vi.fn().mockImplementation(() => () => {}),
    onWindowStateChanged: vi.fn().mockImplementation(() => () => {}),
    triggerIPC: vi.fn().mockImplementation(() => {}),
  },
});

export { context };
