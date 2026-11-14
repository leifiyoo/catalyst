import type { AiAssistantProvider } from "@shared/types";

export type AiProviderOption = {
  value: AiAssistantProvider;
  label: string;
  defaultModel: string;
  defaultBaseUrl: string;
  requiresApiKey: boolean;
};

export const AI_PROVIDER_OPTIONS: AiProviderOption[] = [
  {
    value: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
    requiresApiKey: true,
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    defaultModel: "openai/gpt-4o-mini",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    requiresApiKey: true,
  },
  {
    value: "groq",
    label: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    requiresApiKey: true,
  },
  {
    value: "custom",
    label: "Custom OpenAI-compatible",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "http://localhost:1234/v1",
    requiresApiKey: false,
  },
];

export function getAiProviderOption(provider: AiAssistantProvider): AiProviderOption {
  return (
    AI_PROVIDER_OPTIONS.find((option) => option.value === provider) ||
    AI_PROVIDER_OPTIONS[0]
  );
}

export function getPageTitleFromPath(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/servers") return "Servers";
  if (pathname.startsWith("/servers/")) return "Server Detail";
  if (pathname === "/analytics") return "Analytics";
  if (pathname === "/settings") return "Settings";
  return "Catalyst";
}

export function getServerIdFromPath(pathname: string): string | undefined {
  const match = /^\/servers\/([^/?#]+)/.exec(pathname);
  return match?.[1];
}
