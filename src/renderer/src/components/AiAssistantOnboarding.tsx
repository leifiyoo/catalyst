import { useEffect, useMemo, useState } from "react";
import { Bot, KeyRound, ShieldCheck } from "lucide-react";
import type { AiAssistantProvider, PublicAiAssistantSettings } from "@shared/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  AI_PROVIDER_OPTIONS,
  getAiProviderOption,
} from "@/utils/ai-assistant";

type AiAssistantOnboardingProps = {
  onOpenAssistant: () => void;
};

export function AiAssistantOnboarding({ onOpenAssistant }: AiAssistantOnboardingProps) {
  const [settings, setSettings] = useState<PublicAiAssistantSettings | null>(null);
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<AiAssistantProvider>("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providerOption = useMemo(() => getAiProviderOption(provider), [provider]);

  useEffect(() => {
    let mounted = true;
    window.context.getAiAssistantSettings().then((loaded) => {
      if (!mounted) return;
      setSettings(loaded);
      setProvider(loaded.provider);
      setModel(loaded.model);
      setBaseUrl(loaded.baseUrl);
      setOpen(!loaded.onboardingCompleted);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleProviderChange = (value: string) => {
    const nextProvider = value as AiAssistantProvider;
    const nextOption = getAiProviderOption(nextProvider);
    setProvider(nextProvider);
    setModel(nextOption.defaultModel);
    setBaseUrl(nextOption.defaultBaseUrl);
    setError(null);
  };

  const completeWithoutAssistant = async () => {
    setSaving(true);
    try {
      await window.context.updateAiAssistantSettings({
        enabled: false,
        onboardingCompleted: true,
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const enableAssistant = async () => {
    if (providerOption.requiresApiKey && !apiKey.trim() && !settings?.hasApiKey) {
      setError("Enter an API key for this provider, or choose a local/custom provider.");
      return;
    }
    if (!model.trim()) {
      setError("Enter a model name.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await window.context.updateAiAssistantSettings({
        enabled: true,
        onboardingCompleted: true,
        provider,
        model: model.trim(),
        baseUrl: baseUrl.trim(),
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      setOpen(false);
      onOpenAssistant();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && setOpen(nextOpen)}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <div className="mb-1 grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <DialogTitle>Enable the Catalyst AI assistant?</DialogTitle>
          <DialogDescription>
            This is optional. If enabled, chat requests are sent to the provider you connect.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-2 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">You stay in control</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  The assistant can explain pages and suggest safe server-property actions. It will ask before applying supported changes.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <label className="text-[12.5px] font-medium text-foreground">Provider</label>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose provider" />
                </SelectTrigger>
                <SelectContent>
                  {AI_PROVIDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <label className="text-[12.5px] font-medium text-foreground">Model</label>
              <Input value={model} onChange={(event) => setModel(event.target.value)} />
            </div>

            <div className="grid gap-1.5">
              <label className="text-[12.5px] font-medium text-foreground">Base URL</label>
              <Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
            </div>

            <div className="grid gap-1.5">
              <label className="flex items-center gap-2 text-[12.5px] font-medium text-foreground">
                <KeyRound className="h-3.5 w-3.5" />
                API key
              </label>
              <Input
                type="password"
                value={apiKey}
                placeholder={settings?.hasApiKey ? settings.censoredApiKey || "Saved key" : "Paste provider key"}
                onChange={(event) => setApiKey(event.target.value)}
              />
              <p className="text-[12px] text-muted-foreground">
                Stored locally in Catalyst app data. Leave empty for custom local providers that do not need a key.
              </p>
            </div>

            {error && <p className="text-[12.5px] text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={completeWithoutAssistant} disabled={saving}>
            Not now
          </Button>
          <Button type="button" onClick={enableAssistant} disabled={saving}>
            {saving ? <Spinner className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            Enable assistant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
