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
    getAiAssistantSettings: vi.fn().mockResolvedValue({
      enabled: false,
      onboardingCompleted: true,
      provider: "openai",
      model: "gpt-4o-mini",
      baseUrl: "https://api.openai.com/v1",
      hasApiKey: false,
      censoredApiKey: null,
    }),
    updateAiAssistantSettings: vi.fn().mockImplementation((updates) =>
      Promise.resolve({
        enabled: Boolean(updates.enabled),
        onboardingCompleted: updates.onboardingCompleted ?? true,
        provider: updates.provider ?? "openai",
        model: updates.model ?? "gpt-4o-mini",
        baseUrl: updates.baseUrl ?? "https://api.openai.com/v1",
        hasApiKey: Boolean(updates.apiKey),
        censoredApiKey: updates.apiKey ? "mock...key" : null,
      })
    ),
    sendAiAssistantMessage: vi.fn().mockResolvedValue({
      success: true,
      reply: "Mock response",
      actions: [],
    }),
    applyAiAssistantAction: vi.fn().mockResolvedValue({
      success: true,
      message: "Mock action applied.",
    }),
    triggerIPC: vi.fn().mockImplementation(() => {}),
  },
});

export { context };
