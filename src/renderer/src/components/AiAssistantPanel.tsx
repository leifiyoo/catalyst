import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import type {
  AiAssistantAction,
  AiAssistantClientContext,
  AiAssistantMessage,
  PublicAiAssistantSettings,
} from "@shared/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  getPageTitleFromPath,
  getServerIdFromPath,
} from "@/utils/ai-assistant";
import { useServerStore } from "@/stores/serverStore";

type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: AiAssistantAction[];
};

type AiAssistantPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function createMessage(role: "user" | "assistant", content: string, actions?: AiAssistantAction[]): ChatEntry {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    actions,
  };
}

function toAssistantMessages(messages: ChatEntry[]): AiAssistantMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function latestUserMessage(messages: ChatEntry[]): string {
  return [...messages].reverse().find((message) => message.role === "user")?.content || "";
}

function prefersGerman(messages: ChatEntry[]): boolean {
  return /\b(ich|du|der|die|das|nicht|spieler|server|warum|mach|mache|kann|soll|ändern)\b/i.test(
    latestUserMessage(messages)
  );
}

function formatActionStatus(
  success: boolean,
  messages: ChatEntry[],
  error?: string,
  hasUndo?: boolean
): string {
  if (!success) {
    return prefersGerman(messages)
      ? `Hat nicht geklappt: ${error || "unbekannter Fehler"}`
      : `Did not work: ${error || "unknown error"}`;
  }

  if (prefersGerman(messages)) {
    return hasUndo ? "Erledigt. Undo ist unten, falls du zurück willst." : "Erledigt.";
  }

  return hasUndo ? "Done. Undo is below if you want to roll back." : "Done.";
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={key} className="rounded bg-background/70 px-1 py-0.5 font-data text-[12px] text-primary">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <span key={key}>{part}</span>;
  });
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let codeLines: string[] = [];
  let inCodeBlock = false;
  let bulletLines: string[] = [];

  const flushBullets = () => {
    if (!bulletLines.length) return;
    const start = nodes.length;
    nodes.push(
      <ul key={`ul-${start}`} className="my-1 list-disc space-y-1 pl-4">
        {bulletLines.map((line, index) => (
          <li key={`li-${start}-${index}`}>{renderInlineMarkdown(line, `li-${start}-${index}`)}</li>
        ))}
      </ul>
    );
    bulletLines = [];
  };

  lines.forEach((line, index) => {
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        nodes.push(
          <pre key={`code-${index}`} className="my-2 overflow-x-auto rounded-xl bg-background/80 p-3 font-data text-[12px] leading-relaxed text-foreground">
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        flushBullets();
        inCodeBlock = true;
        codeLines = [];
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      bulletLines.push(bullet[1]);
      return;
    }

    flushBullets();

    if (!line.trim()) {
      nodes.push(<div key={`space-${index}`} className="h-2" />);
      return;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      nodes.push(
        <p key={`heading-${index}`} className="mt-1 font-semibold text-foreground">
          {renderInlineMarkdown(heading[2], `heading-${index}`)}
        </p>
      );
      return;
    }

    nodes.push(
      <p key={`p-${index}`} className="my-1">
        {renderInlineMarkdown(line, `p-${index}`)}
      </p>
    );
  });

  flushBullets();
  if (inCodeBlock) {
    nodes.push(
      <pre key="code-tail" className="my-2 overflow-x-auto rounded-xl bg-background/80 p-3 font-data text-[12px] leading-relaxed text-foreground">
        <code>{codeLines.join("\n")}</code>
      </pre>
    );
  }

  return <div className="select-text">{nodes}</div>;
}

export function AiAssistantPanel({ open, onOpenChange }: AiAssistantPanelProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [settings, setSettings] = useState<PublicAiAssistantSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [applyingActionId, setApplyingActionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatEntry[]>([
    createMessage(
      "assistant",
      "Ask me about this page, crashes, settings, configs, or commands."
    ),
  ]);

  const assistantContext = useMemo<AiAssistantClientContext>(() => {
    const pathname = location.pathname;
    return {
      route: pathname,
      pageTitle: getPageTitleFromPath(pathname),
      serverId: getServerIdFromPath(pathname),
      locale: navigator.language,
    };
  }, [location.pathname]);
  const currentServer = useServerStore((state) =>
    assistantContext.serverId
      ? state.servers.find((server) => server.id === assistantContext.serverId)
      : undefined
  );

  const quickPrompts = useMemo(() => {
    if (assistantContext.serverId) {
      return [
        "What is this page?",
        "Why did this server crash?",
        "Make it possible for more players to join.",
      ];
    }
    if (assistantContext.pageTitle === "Settings") {
      return [
        "What does this setting do?",
        "How should I configure public tunnels?",
        "Is the AI assistant enabled?",
      ];
    }
    return [
      "What is this page?",
      "What should I do next?",
      "How can I improve my server?",
    ];
  }, [assistantContext.pageTitle, assistantContext.serverId]);

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      setSettings(await window.context.getAiAssistantSettings());
    } catch (error) {
      console.error("Failed to load AI assistant settings:", error);
      setSettings(null);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [loadSettings, open]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, open, sending]);

  useEffect(() => {
    if (!open) return;

    const handleGlobalTyping = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-console-input='true'], .console-surface")) return;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.key === "Escape") {
        onOpenChange(false);
        event.preventDefault();
        return;
      }

      if (event.key === "Enter") {
        if (input.trim()) handleSubmit();
        event.preventDefault();
        return;
      }

      if (event.key === "Backspace") {
        setInput((current) => current.slice(0, -1));
        inputRef.current?.focus();
        event.preventDefault();
        return;
      }

      if (event.key.length === 1) {
        setInput((current) => `${current}${event.key}`);
        inputRef.current?.focus();
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleGlobalTyping);
    return () => window.removeEventListener("keydown", handleGlobalTyping);
  }, [input, onOpenChange, open, sending]);

  const configureAssistant = () => {
    navigate("/settings");
    onOpenChange(false);
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMessage = createMessage("user", trimmed);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const result = await window.context.sendAiAssistantMessage({
        messages: toAssistantMessages(nextMessages),
        context: assistantContext,
      });

      if (!result.success) {
        setMessages((current) => [
          ...current,
          createMessage("assistant", result.error || "The assistant could not respond."),
        ]);
        return;
      }

      setMessages((current) => [
        ...current,
        createMessage("assistant", result.reply || "", result.actions || []),
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        createMessage("assistant", `Request failed: ${String(error)}`),
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = () => {
    sendMessage(input);
  };

  const applyAction = async (action: AiAssistantAction) => {
    setApplyingActionId(action.id);
    try {
      const result = await window.context.applyAiAssistantAction(action);
      if (result.success) {
        window.dispatchEvent(
          new CustomEvent("catalyst:servers-refresh", {
            detail: { serverId: result.serverId || action.serverId },
          })
        );
      }
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          formatActionStatus(
            result.success,
            current,
            result.error,
            Boolean(result.undoAction)
          ),
          result.success && result.undoAction ? [result.undoAction] : undefined
        ),
      ]);
    } finally {
      setApplyingActionId(null);
    }
  };

  if (!open) return null;

  const assistantAvailable = settings?.enabled === true;
  const needsKey = Boolean(
    settings && assistantAvailable && !settings.hasApiKey && settings.provider !== "custom"
  );

  return (
    <aside
      className="absolute bottom-0 right-0 top-[60px] z-[70] flex w-[420px] max-w-[calc(100vw-232px)] flex-col border-l border-border bg-card shadow-[-18px_0_40px_rgba(0,0,0,0.24)]"
      aria-label="AI assistant"
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[14.5px] font-semibold text-foreground">
              Catalyst Assistant
            </h2>
            <p className="truncate text-[12px] text-muted-foreground">
              {currentServer ? `Server: ${currentServer.name}` : assistantContext.pageTitle}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => onOpenChange(false)}
          aria-label="Close AI assistant"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="border-b border-border px-4 py-3">
        {loadingSettings ? (
          <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <Spinner className="h-4 w-4" />
            Loading assistant settings
          </div>
        ) : assistantAvailable && !needsKey ? (
          <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Connected to {settings?.provider}
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">
                {assistantAvailable ? "Connect a provider first" : "AI assistant is off"}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Enable it and add a provider key in Settings. The assistant stays optional.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 h-8"
                onClick={configureAssistant}
              >
                <Settings className="h-4 w-4" />
                Open Settings
              </Button>
            </div>
          </div>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[86%] rounded-2xl px-3.5 py-3 text-[13px] leading-relaxed ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-muted/55 text-foreground"
                }`}
              >
                <MarkdownMessage content={message.content} />
                {message.actions && message.actions.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {message.actions.map((action) => (
                      <Button
                        key={action.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto justify-start whitespace-normal rounded-xl px-3 py-2 text-left"
                        onClick={() => applyAction(action)}
                        disabled={Boolean(applyingActionId)}
                      >
                        {applyingActionId === action.id ? (
                          <Spinner className="h-4 w-4" />
                        ) : action.label.toLowerCase().includes("undo") ? (
                          <RotateCcw className="h-4 w-4" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {action.label.toLowerCase().includes("undo") ? "Undo" : "Confirm"}: {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-3 text-[13px] text-muted-foreground">
                <Spinner className="h-4 w-4" />
                Thinking
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-border p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="rounded-full border border-border bg-card px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => sendMessage(prompt)}
              disabled={sending || !assistantAvailable || needsKey}
            >
              {prompt}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask about this page, a setting, or a server issue..."
            className="max-h-32 min-h-[72px] resize-none rounded-2xl"
            disabled={sending || !assistantAvailable || needsKey}
          />
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={handleSubmit}
            disabled={sending || !input.trim() || !assistantAvailable || needsKey}
            aria-label="Send AI assistant message"
          >
            {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </footer>
    </aside>
  );
}
