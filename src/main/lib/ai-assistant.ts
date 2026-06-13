import { app } from "electron";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import type {
  AiAssistantAction,
  AiAssistantActionResult,
  AiAssistantChatRequest,
  AiAssistantChatResult,
  AiAssistantClientContext,
  AiAssistantMessage,
  AiAssistantProvider,
  AiAssistantSettings,
  PublicAiAssistantSettings,
  ServerProperty,
} from "@shared/types";

type ProviderDefinition = {
  label: string;
  defaultModel: string;
  defaultBaseUrl: string;
  requiresApiKey: boolean;
};

type AssistantPromptServer = {
  id: string;
  name: string;
  framework: string;
  version: string;
  status: string;
  ramMB: number;
  players: string;
};

type AssistantPromptContext = AiAssistantClientContext & {
  server?: AssistantPromptServer;
  logs?: { timestamp: string; type: string; text: string }[];
  properties?: Pick<ServerProperty, "key" | "value">[];
};

type ParsedAssistantResponse = {
  reply: string;
  actions: AiAssistantAction[];
};

const SETTINGS_FILE = "ai_assistant_settings.json";
const MAX_MESSAGES = 16;
const MAX_LOG_LINES = 80;

export const AI_PROVIDER_DEFINITIONS: Record<AiAssistantProvider, ProviderDefinition> = {
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
    requiresApiKey: true,
  },
  openrouter: {
    label: "OpenRouter",
    defaultModel: "openai/gpt-4o-mini",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    requiresApiKey: true,
  },
  groq: {
    label: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    requiresApiKey: true,
  },
  custom: {
    label: "Custom OpenAI-compatible",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "http://localhost:1234/v1",
    requiresApiKey: false,
  },
};

export const DEFAULT_AI_ASSISTANT_SETTINGS: AiAssistantSettings = {
  enabled: false,
  onboardingCompleted: false,
  provider: "openai",
  model: AI_PROVIDER_DEFINITIONS.openai.defaultModel,
  baseUrl: AI_PROVIDER_DEFINITIONS.openai.defaultBaseUrl,
  apiKey: "",
};

const ALLOWED_SERVER_PROPERTY_ACTION_KEYS = new Set([
  "max-players",
  "view-distance",
  "simulation-distance",
  "motd",
  "difficulty",
  "pvp",
  "white-list",
  "enforce-whitelist",
  "spawn-protection",
]);

const CONTEXT_PROPERTY_KEYS = new Set([
  "max-players",
  "server-port",
  "difficulty",
  "gamemode",
  "online-mode",
  "white-list",
  "enforce-whitelist",
  "view-distance",
  "simulation-distance",
  "motd",
  "pvp",
  "spawn-protection",
]);

const CONFIG_FILE_EXTENSIONS = new Set([
  ".yml",
  ".yaml",
  ".json",
  ".toml",
  ".properties",
  ".conf",
  ".cfg",
  ".txt",
]);

function getSettingsPath(): string {
  return join(app.getPath("userData"), SETTINGS_FILE);
}

function isAiAssistantProvider(value: unknown): value is AiAssistantProvider {
  return (
    value === "openai" ||
    value === "openrouter" ||
    value === "groq" ||
    value === "custom"
  );
}

function normalizeBaseUrl(value: unknown, provider: AiAssistantProvider): string {
  if (typeof value !== "string" || !value.trim()) {
    return AI_PROVIDER_DEFINITIONS[provider].defaultBaseUrl;
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return AI_PROVIDER_DEFINITIONS[provider].defaultBaseUrl;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return AI_PROVIDER_DEFINITIONS[provider].defaultBaseUrl;
  }
}

export function normalizeAiAssistantSettings(value: unknown): AiAssistantSettings {
  const candidate =
    typeof value === "object" && value !== null
      ? (value as Partial<AiAssistantSettings>)
      : {};

  const provider = isAiAssistantProvider(candidate.provider)
    ? candidate.provider
    : DEFAULT_AI_ASSISTANT_SETTINGS.provider;

  const providerDefinition = AI_PROVIDER_DEFINITIONS[provider];
  const model =
    typeof candidate.model === "string" && candidate.model.trim()
      ? candidate.model.trim()
      : providerDefinition.defaultModel;

  return {
    enabled:
      typeof candidate.enabled === "boolean"
        ? candidate.enabled
        : DEFAULT_AI_ASSISTANT_SETTINGS.enabled,
    onboardingCompleted:
      typeof candidate.onboardingCompleted === "boolean"
        ? candidate.onboardingCompleted
        : DEFAULT_AI_ASSISTANT_SETTINGS.onboardingCompleted,
    provider,
    model,
    baseUrl: normalizeBaseUrl(candidate.baseUrl, provider),
    apiKey:
      typeof candidate.apiKey === "string" ? candidate.apiKey.trim() : "",
  };
}

function mergeAiAssistantSettings(
  current: unknown,
  updates: Partial<AiAssistantSettings>
): AiAssistantSettings {
  const normalizedCurrent = normalizeAiAssistantSettings(current);
  const provider = isAiAssistantProvider(updates.provider)
    ? updates.provider
    : normalizedCurrent.provider;
  const providerChanged = provider !== normalizedCurrent.provider;
  const providerDefinition = AI_PROVIDER_DEFINITIONS[provider];

  return normalizeAiAssistantSettings({
    ...normalizedCurrent,
    ...updates,
    provider,
    model:
      typeof updates.model === "string"
        ? updates.model
        : providerChanged
          ? providerDefinition.defaultModel
          : normalizedCurrent.model,
    baseUrl:
      typeof updates.baseUrl === "string"
        ? updates.baseUrl
        : providerChanged
          ? providerDefinition.defaultBaseUrl
          : normalizedCurrent.baseUrl,
    apiKey:
      typeof updates.apiKey === "string"
        ? updates.apiKey
        : normalizedCurrent.apiKey,
  });
}

function censorApiKey(apiKey: string): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 8) return "*".repeat(apiKey.length);
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

export function toPublicAiAssistantSettings(
  settings: AiAssistantSettings
): PublicAiAssistantSettings {
  return {
    enabled: settings.enabled,
    onboardingCompleted: settings.onboardingCompleted,
    provider: settings.provider,
    model: settings.model,
    baseUrl: settings.baseUrl,
    hasApiKey: Boolean(settings.apiKey),
    censoredApiKey: censorApiKey(settings.apiKey),
  };
}

async function readAiAssistantSettings(): Promise<AiAssistantSettings> {
  try {
    const raw = await readFile(getSettingsPath(), "utf8");
    return normalizeAiAssistantSettings(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("Failed to read AI assistant settings:", error);
    }
    return { ...DEFAULT_AI_ASSISTANT_SETTINGS };
  }
}

async function writeAiAssistantSettings(
  settings: AiAssistantSettings
): Promise<void> {
  const settingsPath = getSettingsPath();
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
}

export async function getAiAssistantSettings(): Promise<PublicAiAssistantSettings> {
  return toPublicAiAssistantSettings(await readAiAssistantSettings());
}

export async function updateAiAssistantSettings(
  updates: Partial<AiAssistantSettings>
): Promise<PublicAiAssistantSettings> {
  const current = await readAiAssistantSettings();
  const next = mergeAiAssistantSettings(current, updates);
  await writeAiAssistantSettings(next);
  return toPublicAiAssistantSettings(next);
}

function normalizeMessages(messages: AiAssistantMessage[]): AiAssistantMessage[] {
  return messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim()
    )
    .slice(-MAX_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 6000),
    }));
}

function normalizeActionValue(key: string, value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return null;
  }

  const raw = String(value).trim();
  if (!raw || /[\r\n]/.test(raw) || raw.length > 160) return null;

  if (key === "max-players") {
    const count = Number(raw);
    if (!Number.isInteger(count) || count < 1 || count > 100000) return null;
    return String(count);
  }

  return raw;
}

function normalizeActionLabel(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 80)
    : fallback;
}

function normalizeConfigRelativePath(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().replace(/\\/g, "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[a-z]:\//i.test(normalized) ||
    normalized.split("/").some((part) => part === ".." || part === "")
  ) {
    return null;
  }

  const lower = normalized.toLowerCase();
  const isPluginOrModConfig =
    lower.startsWith("plugins/") ||
    lower.startsWith("mods/") ||
    lower.startsWith("config/");

  const extension = lower.includes(".")
    ? lower.slice(lower.lastIndexOf("."))
    : "";

  if (!isPluginOrModConfig || !CONFIG_FILE_EXTENSIONS.has(extension)) {
    return null;
  }

  return normalized;
}

function normalizeConfigContent(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.includes("\0")) return null;
  if (Buffer.byteLength(value, "utf-8") > 120_000) return null;
  return value;
}

function normalizeServerCommand(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const command = value.trim().replace(/^\//, "");
  if (!command || /[\r\n]/.test(command) || command.length > 200) return null;
  return command;
}

export function updatePlayerCapacityString(currentPlayers: string | undefined, maxPlayers: string): string {
  const max = Number(maxPlayers);
  if (!Number.isInteger(max) || max < 1) return currentPlayers || "0/20";

  const current = typeof currentPlayers === "string" ? currentPlayers : "";
  const match = /^(\d+)\s*\/\s*\d+$/.exec(current);
  const online = match ? Number(match[1]) : 0;
  return `${Number.isFinite(online) ? online : 0}/${max}`;
}

export function normalizeAssistantActions(
  value: unknown,
  context: { serverId?: string }
): AiAssistantAction[] {
  if (!Array.isArray(value) || !context.serverId) return [];

  const actions: AiAssistantAction[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const candidate = item as Partial<AiAssistantAction>;
    if (candidate.serverId !== context.serverId) continue;

    if (candidate.kind === "setServerProperty") {
      if (
        typeof candidate.key !== "string" ||
        !ALLOWED_SERVER_PROPERTY_ACTION_KEYS.has(candidate.key)
      ) {
        continue;
      }

      const value = normalizeActionValue(candidate.key, candidate.value);
      if (value === null) continue;

      actions.push({
        id: `setServerProperty:${candidate.key}:${value}`,
        kind: "setServerProperty",
        serverId: context.serverId,
        key: candidate.key,
        value,
        label: normalizeActionLabel(candidate.label, `Set ${candidate.key} to ${value}`),
        requiresConfirmation: true,
      });
      continue;
    }

    if (candidate.kind === "writeServerFile") {
      const relativePath = normalizeConfigRelativePath(candidate.relativePath);
      const content = normalizeConfigContent(candidate.content);
      if (!relativePath || content === null) continue;

      actions.push({
        id: `writeServerFile:${relativePath}`,
        kind: "writeServerFile",
        serverId: context.serverId,
        relativePath,
        content,
        label: normalizeActionLabel(candidate.label, `Update ${relativePath}`),
        requiresConfirmation: true,
      });
      continue;
    }

    if (candidate.kind === "sendServerCommand") {
      const command = normalizeServerCommand(candidate.command);
      if (!command) continue;

      actions.push({
        id: `sendServerCommand:${command}`,
        kind: "sendServerCommand",
        serverId: context.serverId,
        command,
        label: normalizeActionLabel(candidate.label, `Run ${command}`),
        requiresConfirmation: true,
      });
    }
  }

  return actions;
}

function stripJsonFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function parseAssistantModelResponse(
  rawContent: string,
  context: { serverId?: string }
): ParsedAssistantResponse {
  const content = rawContent.trim();
  if (!content) {
    return {
      reply: "I could not generate a response. Please try again.",
      actions: [],
    };
  }

  try {
    const parsed = JSON.parse(stripJsonFence(content)) as {
      reply?: unknown;
      actions?: unknown;
    };

    if (typeof parsed.reply === "string" && parsed.reply.trim()) {
      return {
        reply: parsed.reply.trim(),
        actions: normalizeAssistantActions(parsed.actions, context),
      };
    }
  } catch {
    // Plain text responses are accepted as a compatibility fallback.
  }

  return {
    reply: content,
    actions: [],
  };
}

function formatServerContext(server: AssistantPromptServer): string {
  return [
    `id=${server.id}`,
    `name=${server.name}`,
    `framework=${server.framework}`,
    `version=${server.version}`,
    `status=${server.status}`,
    `ramMB=${server.ramMB}`,
    `players=${server.players}`,
  ].join(", ");
}

export function buildAiAssistantSystemPrompt(context: AssistantPromptContext): string {
  const lines = [
    "You are the optional AI assistant inside Catalyst, a desktop Minecraft server manager.",
    "Only answer questions related to Catalyst or Minecraft server management. For unrelated topics, briefly say you can only help with Catalyst/Minecraft.",
    "Your job is to explain the current page, explain settings, diagnose server problems, suggest safe changes, edit plugin/mod config files, and propose Minecraft server commands.",
    "Match the language of the latest user message. Do not use locale as the main language signal unless the message language is unclear.",
    "Keep every reply short, casual, relaxed, and useful. Aim for 1-4 short sentences unless important detail would be lost.",
    "Use Markdown in reply text: bullets, inline code, and short code blocks when helpful.",
    `Locale: ${context.locale || "unknown"}`,
    `Current route: ${context.route}`,
    `Current page: ${context.pageTitle}`,
  ];

  if (context.server) {
    lines.push(`Current server: ${formatServerContext(context.server)}`);
  }

  if (context.properties?.length) {
    lines.push(
      "Relevant server.properties:",
      ...context.properties.map((property) => `${property.key}=${property.value}`)
    );
  }

  if (context.logs?.length) {
    lines.push(
      "Recent console logs:",
      ...context.logs.map((line) => `[${line.type}] ${line.text}`)
    );
  }

  lines.push(
    "Never claim that you changed files or settings unless you return an allowed action and the user applies it.",
    "Every action requires user confirmation in Catalyst before it is applied.",
    "Allowed server.properties action: {\"kind\":\"setServerProperty\",\"serverId\":\"...\",\"key\":\"max-players\",\"value\":\"40\",\"label\":\"Set max players to 40\"}.",
    "Allowed plugin/mod config action: {\"kind\":\"writeServerFile\",\"serverId\":\"...\",\"relativePath\":\"plugins/Plugin/config.yml\",\"content\":\"...\",\"label\":\"Update config\"}.",
    "Allowed Minecraft command action: {\"kind\":\"sendServerCommand\",\"serverId\":\"...\",\"command\":\"say Restart in 5 minutes\",\"label\":\"Announce restart\"}. Commands are sent only after user confirmation.",
    "Only these server.properties keys can be actioned: max-players, view-distance, simulation-distance, motd, difficulty, pvp, white-list, enforce-whitelist, spawn-protection.",
    "Plugin/mod config edits are limited to config-like files under plugins/, mods/, or config/.",
    "Return JSON only in this shape: {\"reply\":\"Markdown response text\",\"actions\":[]}.",
    "If no action is needed, return an empty actions array."
  );

  return lines.join("\n");
}

async function buildPromptContext(
  context: AiAssistantClientContext
): Promise<AssistantPromptContext> {
  const promptContext: AssistantPromptContext = {
    locale: context.locale,
    route: context.route,
    pageTitle: context.pageTitle,
    serverId: context.serverId,
  };

  if (!context.serverId) {
    return promptContext;
  }

  const { getServer, getServerProperties } = await import("./server-manager");
  const { getServerLogs } = await import("./server-runner");
  const server = await getServer(context.serverId);
  if (!server) {
    return promptContext;
  }

  promptContext.server = {
    id: server.id,
    name: server.name,
    framework: server.framework,
    version: server.version,
    status: server.status,
    ramMB: server.ramMB,
    players: server.players,
  };

  try {
    const [logs, properties] = await Promise.all([
      getServerLogs(server.id),
      getServerProperties(server.serverPath),
    ]);
    promptContext.logs = logs.slice(-MAX_LOG_LINES);
    promptContext.properties = properties
      .filter((property) => CONTEXT_PROPERTY_KEYS.has(property.key))
      .map((property) => ({ key: property.key, value: property.value }));
  } catch (error) {
    console.warn("Failed to build AI assistant server context:", error);
  }

  return promptContext;
}

function getChatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

async function readJsonOrText(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text };
  }
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null) {
    const candidate = payload as {
      error?: { message?: unknown } | string;
      message?: unknown;
    };
    if (typeof candidate.error === "string") return candidate.error;
    if (
      typeof candidate.error === "object" &&
      candidate.error !== null &&
      typeof candidate.error.message === "string"
    ) {
      return candidate.error.message;
    }
    if (typeof candidate.message === "string") return candidate.message;
  }
  return fallback;
}

function readAssistantContent(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const candidate = payload as {
    choices?: { message?: { content?: unknown }; text?: unknown }[];
  };
  const firstChoice = candidate.choices?.[0];
  if (typeof firstChoice?.message?.content === "string") {
    return firstChoice.message.content;
  }
  if (typeof firstChoice?.text === "string") {
    return firstChoice.text;
  }
  return null;
}

export async function sendAiAssistantMessage(
  request: AiAssistantChatRequest
): Promise<AiAssistantChatResult> {
  const settings = await readAiAssistantSettings();
  if (!settings.enabled) {
    return { success: false, error: "AI assistant is disabled." };
  }

  const provider = AI_PROVIDER_DEFINITIONS[settings.provider];
  if (provider.requiresApiKey && !settings.apiKey) {
    return { success: false, error: `${provider.label} needs an API key first.` };
  }

  const messages = normalizeMessages(request.messages);
  if (!messages.length) {
    return { success: false, error: "Send a message first." };
  }

  const promptContext = await buildPromptContext(request.context);
  const response = await fetch(getChatCompletionsUrl(settings.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
      ...(settings.provider === "openrouter"
        ? {
            "HTTP-Referer": "https://catalyst.local",
            "X-Title": "Catalyst",
          }
        : {}),
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.2,
      max_tokens: 450,
      messages: [
        { role: "system", content: buildAiAssistantSystemPrompt(promptContext) },
        ...messages,
      ],
    }),
  });

  const payload = await readJsonOrText(response);
  if (!response.ok) {
    return {
      success: false,
      error: getErrorMessage(payload, `Provider request failed with ${response.status}.`),
    };
  }

  const content = readAssistantContent(payload);
  if (!content) {
    return { success: false, error: "Provider returned no assistant message." };
  }

  const parsed = parseAssistantModelResponse(content, {
    serverId: request.context.serverId,
  });

  return {
    success: true,
    reply: parsed.reply,
    actions: parsed.actions,
  };
}

export async function applyAiAssistantAction(
  action: AiAssistantAction
): Promise<AiAssistantActionResult> {
  const [normalizedAction] = normalizeAssistantActions([action], {
    serverId: action.serverId,
  });

  if (!normalizedAction) {
    return { success: false, error: "This assistant action is not allowed." };
  }

  const {
    getServer,
    getServerProperties,
    readServerFile,
    saveServerProperties,
    updateServerStatus,
    writeServerFile,
  } = await import("./server-manager");
  const server = await getServer(normalizedAction.serverId);
  if (!server) {
    return { success: false, error: "Server not found." };
  }

  if (normalizedAction.kind === "writeServerFile") {
    const previous = await readServerFile(server.id, normalizedAction.relativePath);
    const result = await writeServerFile(
      server.id,
      normalizedAction.relativePath,
      normalizedAction.content
    );
    if (!result.success) {
      return { success: false, error: result.error || "Failed to save config file." };
    }

    return {
      success: true,
      serverId: server.id,
      message: `${normalizedAction.relativePath} was updated. Restart or reload the plugin if needed.`,
      undoAction: previous.success && previous.content !== undefined
        ? {
            id: `writeServerFile:${normalizedAction.relativePath}:undo`,
            kind: "writeServerFile",
            serverId: server.id,
            relativePath: normalizedAction.relativePath,
            content: previous.content,
            label: `Undo ${normalizedAction.relativePath}`,
            requiresConfirmation: true,
          }
        : undefined,
    };
  }

  if (normalizedAction.kind === "sendServerCommand") {
    const { isRunning, sendCommand } = await import("./server-runner");
    if (!isRunning(server.id)) {
      return { success: false, error: "Server is offline. Start it before running commands." };
    }

    sendCommand(server.id, normalizedAction.command);
    return {
      success: true,
      serverId: server.id,
      message: `Command sent: ${normalizedAction.command}`,
    };
  }

  const properties = await getServerProperties(server.serverPath);
  const index = properties.findIndex(
    (property) => property.key === normalizedAction.key
  );
  const previousValue = index >= 0 ? properties[index].value : undefined;
  const nextProperty: ServerProperty = {
    key: normalizedAction.key,
    value: normalizedAction.value,
  };

  if (index >= 0) {
    properties[index] = {
      ...properties[index],
      value: normalizedAction.value,
    };
  } else {
    properties.push(nextProperty);
  }

  const result = await saveServerProperties(server.serverPath, properties);
  if (!result.success) {
    return { success: false, error: result.error || "Failed to save server.properties." };
  }

  if (normalizedAction.key === "max-players") {
    await updateServerStatus(
      server.id,
      server.status,
      updatePlayerCapacityString(server.players, normalizedAction.value)
    );
  }

  return {
    success: true,
    serverId: server.id,
    message: `${normalizedAction.key} was set to ${normalizedAction.value}. Restart the server if Minecraft requires it.`,
    undoAction: previousValue !== undefined
      ? {
          id: `setServerProperty:${normalizedAction.key}:${previousValue}:undo`,
          kind: "setServerProperty",
          serverId: server.id,
          key: normalizedAction.key,
          value: previousValue,
          label: `Undo ${normalizedAction.key}`,
          requiresConfirmation: true,
        }
      : undefined,
  };
}
