import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Bot, Check, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
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
    if (!window.context?.getAiAssistantSettings) return;

    let mounted = true;
    window.context
      .getAiAssistantSettings()
      .then((loaded) => {
        if (!mounted) return;
        setSettings(loaded);
        setProvider(loaded.provider);
        setModel(loaded.model);
        setBaseUrl(loaded.baseUrl);
        setOpen(!loaded.onboardingCompleted);
      })
      .catch((loadError) => {
        console.error("Failed to load AI assistant settings:", loadError);
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
      <DialogContent className="max-h-[92vh] max-w-[860px] overflow-y-auto p-0">
        <div className="grid min-h-[600px] md:grid-cols-[300px_1fr]">
          <aside className="relative overflow-hidden border-b border-border bg-[#17191C] p-7 text-white md:border-b-0 md:border-r">
            <div className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="relative flex h-full flex-col">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-[#8FA8F1] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"><Sparkles className="h-5 w-5" /></div>
              <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8FA8F1]">Optional setup</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">A copilot for your server.</h2>
              <p className="mt-3 text-[13px] leading-relaxed text-[#AEB3BC]">Connect a provider once, then ask Catalyst to explain settings and prepare safe changes.</p>
              <div className="mt-9 space-y-5">
                {[["1", "Choose a provider", "Cloud or a local endpoint"], ["2", "Review the connection", "Model and endpoint stay editable"], ["3", "You approve changes", "Nothing is applied silently"]].map(([step, title, detail], index) => (
                  <motion.div key={step} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 + index * 0.07, duration: 0.35 }} className="flex gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-[11px] font-semibold text-[#AFC0F5]">{step}</span>
                    <div><p className="text-[13px] font-medium text-white">{title}</p><p className="mt-0.5 text-[11.5px] text-[#9298A2]">{detail}</p></div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-auto flex items-center gap-2 pt-8 text-[11.5px] text-[#9298A2]"><ShieldCheck className="h-4 w-4 text-[#8FA8F1]" />Credentials are stored on this device.</div>
            </motion.div>
          </aside>
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.42, ease: [0.16, 1, 0.3, 1] }} className="flex min-w-0 flex-col p-7 md:p-8">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Bot className="h-5 w-5" /></div>
                <div><DialogTitle>Connect the AI assistant</DialogTitle><DialogDescription className="mt-1">You can change or disable this later in Settings.</DialogDescription></div>
              </div>
            </DialogHeader>
            <div className="mt-7 grid gap-5">
              <div className="grid gap-2">
                <label className="text-[12.5px] font-medium text-foreground">Provider</label>
                <Select value={provider} onValueChange={handleProviderChange}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Choose provider" /></SelectTrigger>
                  <SelectContent>{AI_PROVIDER_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2"><label className="text-[12.5px] font-medium text-foreground">Model</label><Input className="h-11" value={model} onChange={(event) => setModel(event.target.value)} /></div>
                <div className="grid gap-2"><label className="text-[12.5px] font-medium text-foreground">Base URL</label><Input className="h-11" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></div>
              </div>
              <div className="grid gap-2">
                <label className="flex items-center gap-2 text-[12.5px] font-medium text-foreground"><KeyRound className="h-3.5 w-3.5 text-muted-foreground" />API key</label>
                <Input className="h-11" type="password" value={apiKey} placeholder={settings?.hasApiKey ? settings.censoredApiKey || "Saved key" : "Paste provider key"} onChange={(event) => setApiKey(event.target.value)} />
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">Leave empty for local providers that do not require authentication.</p>
              </div>
              <div className="rounded-2xl border border-primary/15 bg-primary/[0.06] p-4">
                <div className="flex items-center gap-2 text-[12.5px] font-medium text-foreground"><Check className="h-4 w-4 text-primary" />Ready for review</div>
                <p className="mt-1.5 pl-6 text-[11.5px] leading-relaxed text-muted-foreground">Catalyst will always show the proposed server change before it is applied.</p>
              </div>
              {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[12.5px] text-destructive">{error}</motion.p>}
            </div>
            <DialogFooter className="mt-auto pt-7">
              <Button type="button" variant="ghost" onClick={completeWithoutAssistant} disabled={saving}>Skip for now</Button>
              <Button type="button" onClick={enableAssistant} disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : <Bot className="h-4 w-4" />}Enable assistant</Button>
            </DialogFooter>
          </motion.section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
