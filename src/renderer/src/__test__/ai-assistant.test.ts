import { describe, expect, test } from "vitest";

import {
  DEFAULT_AI_ASSISTANT_SETTINGS,
  buildAiAssistantSystemPrompt,
  normalizeAiAssistantSettings,
  normalizeAssistantActions,
  parseAssistantModelResponse,
  updatePlayerCapacityString,
} from "../../../main/lib/ai-assistant";

describe("AI assistant helpers", () => {
  test("keeps the assistant disabled until the user explicitly opts in", () => {
    expect(normalizeAiAssistantSettings(undefined)).toEqual(DEFAULT_AI_ASSISTANT_SETTINGS);
    expect(normalizeAiAssistantSettings({})).toEqual(DEFAULT_AI_ASSISTANT_SETTINGS);

    expect(
      normalizeAiAssistantSettings({
        enabled: true,
        onboardingCompleted: true,
        provider: "openrouter",
        model: "openai/gpt-4o-mini",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "secret",
      })
    ).toEqual({
      enabled: true,
      onboardingCompleted: true,
      provider: "openrouter",
      model: "openai/gpt-4o-mini",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "secret",
    });
  });

  test("normalizes unsafe or incomplete assistant settings", () => {
    expect(
      normalizeAiAssistantSettings({
        enabled: "yes",
        onboardingCompleted: "yes",
        provider: "unknown",
        model: "",
        baseUrl: "file:///tmp/key",
        apiKey: 123,
      })
    ).toEqual(DEFAULT_AI_ASSISTANT_SETTINGS);
  });

  test("parses JSON assistant responses while falling back to plain text", () => {
    expect(
      parseAssistantModelResponse(
        '{"reply":"Raise the max player limit first.","actions":[{"kind":"setServerProperty","serverId":"srv-1","key":"max-players","value":"40","label":"Set max players to 40"}]}',
        { serverId: "srv-1" }
      )
    ).toEqual({
      reply: "Raise the max player limit first.",
      actions: [
        {
          id: "setServerProperty:max-players:40",
          kind: "setServerProperty",
          serverId: "srv-1",
          key: "max-players",
          value: "40",
          label: "Set max players to 40",
          requiresConfirmation: true,
        },
      ],
    });

    expect(parseAssistantModelResponse("Plain explanation", { serverId: "srv-1" })).toEqual({
      reply: "Plain explanation",
      actions: [],
    });
  });

  test("allows only safe assistant actions for the current server", () => {
    expect(
      normalizeAssistantActions(
        [
          {
            kind: "setServerProperty",
            serverId: "srv-1",
            key: "max-players",
            value: "50",
            label: "Set max players to 50",
          },
          {
            kind: "setServerProperty",
            serverId: "srv-2",
            key: "max-players",
            value: "100",
            label: "Touch another server",
          },
          {
            kind: "setServerProperty",
            serverId: "srv-1",
            key: "rcon.password",
            value: "secret",
            label: "Change RCON password",
          },
        ],
        { serverId: "srv-1" }
      )
    ).toEqual([
      {
        id: "setServerProperty:max-players:50",
        kind: "setServerProperty",
        serverId: "srv-1",
        key: "max-players",
        value: "50",
        label: "Set max players to 50",
        requiresConfirmation: true,
      },
    ]);
  });

  test("allows safe plugin config edits and server commands only for the current server", () => {
    expect(
      normalizeAssistantActions(
        [
          {
            kind: "writeServerFile",
            serverId: "srv-1",
            relativePath: "plugins/Essentials/config.yml",
            content: "spawn-on-join: true\n",
            label: "Update Essentials config",
          },
          {
            kind: "sendServerCommand",
            serverId: "srv-1",
            command: "say Server restarts in 5 minutes",
            label: "Announce restart",
          },
          {
            kind: "writeServerFile",
            serverId: "srv-1",
            relativePath: "../server.properties",
            content: "bad",
            label: "Path traversal",
          },
          {
            kind: "sendServerCommand",
            serverId: "srv-2",
            command: "stop",
            label: "Wrong server",
          },
        ],
        { serverId: "srv-1" }
      )
    ).toEqual([
      {
        id: "writeServerFile:plugins/Essentials/config.yml",
        kind: "writeServerFile",
        serverId: "srv-1",
        relativePath: "plugins/Essentials/config.yml",
        content: "spawn-on-join: true\n",
        label: "Update Essentials config",
        requiresConfirmation: true,
      },
      {
        id: "sendServerCommand:say Server restarts in 5 minutes",
        kind: "sendServerCommand",
        serverId: "srv-1",
        command: "say Server restarts in 5 minutes",
        label: "Announce restart",
        requiresConfirmation: true,
      },
    ]);
  });

  test("updates the saved player capacity string when max-players changes", () => {
    expect(updatePlayerCapacityString("0/20", "50")).toBe("0/50");
    expect(updatePlayerCapacityString("7/20", "50")).toBe("7/50");
    expect(updatePlayerCapacityString("unknown", "50")).toBe("0/50");
  });

  test("builds a Catalyst-specific system prompt with page and server context", () => {
    const prompt = buildAiAssistantSystemPrompt({
      locale: "de-DE",
      route: "/servers/srv-1",
      pageTitle: "Server Detail",
      server: {
        id: "srv-1",
        name: "Survival",
        framework: "Paper",
        version: "1.21.4",
        status: "Offline",
        ramMB: 4096,
        players: "0/20",
      },
      logs: [
        { timestamp: "2026-06-13T17:00:00.000Z", type: "stderr", text: "java.lang.OutOfMemoryError" },
      ],
      properties: [{ key: "max-players", value: "20" }],
    });

    expect(prompt).toContain("Catalyst");
    expect(prompt).toContain("Server Detail");
    expect(prompt).toContain("Survival");
    expect(prompt).toContain("OutOfMemoryError");
    expect(prompt).toContain("max-players=20");
    expect(prompt).toContain("Markdown");
    expect(prompt).toContain("latest user message");
    expect(prompt).toContain("short");
    expect(prompt).toContain("Catalyst or Minecraft");
    expect(prompt).toContain("user confirmation");
    expect(prompt).toContain("plugin");
  });
});
