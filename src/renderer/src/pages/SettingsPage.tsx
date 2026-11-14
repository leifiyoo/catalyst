import { useState, useEffect, useRef } from "react"
import { motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { Bot, CheckCircle2, ExternalLink, KeyRound, Trash2, Palette, Globe, Info, ShieldAlert } from "lucide-react"
import type { AiAssistantProvider, PublicAiAssistantSettings } from "@shared/types"
import { getStoredTheme, setStoredTheme, type ThemeMode } from "@/utils/theme"
type SettingsCategory = "application" | "connectivity" | "assistant" | "about"

const SETTINGS_CATEGORIES = [
    { id: "application" as const, label: "Application", detail: "Look & behavior", icon: Palette },
    { id: "connectivity" as const, label: "Connectivity", detail: "Tunnels & access", icon: Globe },
    { id: "assistant" as const, label: "Assistant", detail: "AI provider", icon: Bot },
    { id: "about" as const, label: "About", detail: "Version & details", icon: Info },
]
import { AI_PROVIDER_OPTIONS, getAiProviderOption } from "@/utils/ai-assistant"

function SettingsSection({
    icon: Icon,
    title,
    description,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>
    title: string
    description: string
    children: React.ReactNode
}) {
    return (
        <section className="rounded-2xl border border-border bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                <div className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background text-muted-foreground">
                    <Icon className="h-4 w-4" />
                </div>
                <div>
                    <h2 className="text-[14.5px] font-semibold leading-none text-foreground">{title}</h2>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">{description}</p>
                </div>
            </div>
            <div className="px-5 py-5">{children}</div>
        </section>
    )
}

export function SettingsPage() {
    const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(() => {
        return () => {
            if (successTimerRef.current) clearTimeout(successTimerRef.current)
        }
    }, [])

    const [theme, setTheme] = useState<ThemeMode>("dark")
    const [ngrokEnabled, setNgrokEnabledState] = useState(true)
    const [askBeforeClose, setAskBeforeClose] = useState(true)
    const [aiSettings, setAiSettings] = useState<PublicAiAssistantSettings | null>(null)
    const [aiEnabled, setAiEnabled] = useState(false)
    const [aiProvider, setAiProvider] = useState<AiAssistantProvider>("openai")
    const [aiModel, setAiModel] = useState("gpt-4o-mini")
    const [aiBaseUrl, setAiBaseUrl] = useState("https://api.openai.com/v1")
    const [aiApiKey, setAiApiKey] = useState("")
    const [aiSaving, setAiSaving] = useState(false)
    const [aiSuccess, setAiSuccess] = useState(false)
    const [censoredToken, setCensoredToken] = useState<string | null>(null)
    const [hasToken, setHasToken] = useState(false)
    const [loading, setLoading] = useState(true)

    const [showTokenDialog, setShowTokenDialog] = useState(false)
    const [showRemoveDialog, setShowRemoveDialog] = useState(false)
    const [newToken, setNewToken] = useState("")
    const [tokenValidating, setTokenValidating] = useState(false)
    const [tokenError, setTokenError] = useState<string | null>(null)
    const [tokenSuccess, setTokenSuccess] = useState(false)
    const [activeCategory, setActiveCategory] = useState<SettingsCategory>("application")

    useEffect(() => {
        setTheme(getStoredTheme())
        loadSettings()
    }, [])

    const loadSettings = async () => {
        setLoading(true)
        if (!window.context) {
            setLoading(false)
            return
        }

        try {
            const [enabled, token, appPreferences, assistantSettings] = await Promise.all([
                window.context.isNgrokEnabled(),
                window.context.getNgrokAuthtokenCensored(),
                window.context.getAppPreferences(),
                window.context.getAiAssistantSettings()
            ])
            setNgrokEnabledState(enabled)
            setCensoredToken(token)
            setHasToken(!!token)
            setAskBeforeClose(appPreferences.askBeforeClose)
            syncAiSettings(assistantSettings)
        } catch (error) {
            console.error("Failed to load settings:", error)
        } finally {
            setLoading(false)
        }
    }

    const syncAiSettings = (assistantSettings: PublicAiAssistantSettings) => {
        setAiSettings(assistantSettings)
        setAiEnabled(assistantSettings.enabled)
        setAiProvider(assistantSettings.provider)
        setAiModel(assistantSettings.model)
        setAiBaseUrl(assistantSettings.baseUrl)
        setAiApiKey("")
    }

    const handleToggleNgrok = async (enabled: boolean) => {
        await window.context.setNgrokEnabled(enabled)
        setNgrokEnabledState(enabled)
    }

    const handleToggleCloseWarning = async (enabled: boolean) => {
        const preferences = await window.context.updateAppPreferences({ askBeforeClose: enabled })
        setAskBeforeClose(preferences.askBeforeClose)
    }

    const handleToggleAiEnabled = async (enabled: boolean) => {
        const updated = await window.context.updateAiAssistantSettings({
            enabled,
            onboardingCompleted: true,
        })
        syncAiSettings(updated)
    }

    const handleAiProviderChange = (value: string) => {
        const provider = value as AiAssistantProvider
        const option = getAiProviderOption(provider)
        setAiProvider(provider)
        setAiModel(option.defaultModel)
        setAiBaseUrl(option.defaultBaseUrl)
    }

    const handleSaveAiAssistant = async () => {
        setAiSaving(true)
        try {
            const updated = await window.context.updateAiAssistantSettings({
                enabled: aiEnabled,
                onboardingCompleted: true,
                provider: aiProvider,
                model: aiModel.trim(),
                baseUrl: aiBaseUrl.trim(),
                ...(aiApiKey.trim() ? { apiKey: aiApiKey.trim() } : {}),
            })
            syncAiSettings(updated)
            setAiSuccess(true)
            if (successTimerRef.current) clearTimeout(successTimerRef.current)
            successTimerRef.current = setTimeout(() => setAiSuccess(false), 3000)
        } finally {
            setAiSaving(false)
        }
    }

    const handleThemeChange = (value: string) => {
        const nextTheme: ThemeMode = value === "light" ? "light" : "dark"
        setTheme(nextTheme)
        setStoredTheme(nextTheme)
    }

    const handleValidateAndSaveToken = async () => {
        if (!newToken.trim()) {
            setTokenError("Please enter an authtoken")
            return
        }

        setTokenValidating(true)
        setTokenError(null)

        const validationResult = await window.context.validateNgrokAuthtoken(newToken.trim())
        if (!validationResult.valid) {
            setTokenError(validationResult.error || "Invalid authtoken")
            setTokenValidating(false)
            return
        }

        const configureResult = await window.context.configureNgrokAuthtoken(newToken.trim())
        if (!configureResult.success) {
            setTokenError(configureResult.error || "Failed to save authtoken")
            setTokenValidating(false)
            return
        }

        setTokenValidating(false)
        setShowTokenDialog(false)
        setNewToken("")
        setTokenSuccess(true)
        if (successTimerRef.current) clearTimeout(successTimerRef.current)
        successTimerRef.current = setTimeout(() => setTokenSuccess(false), 3000)

        await loadSettings()
    }

    const handleRemoveToken = async () => {
        const result = await window.context.removeNgrokAuthtoken()
        if (result.success) {
            setShowRemoveDialog(false)
            setCensoredToken(null)
            setHasToken(false)
        } else {
            console.error("Failed to remove token:", result.error)
        }
    }

    return (
        <motion.section
            initial={false}
            className="mx-auto flex w-full max-w-[1040px] flex-col gap-5 px-8 pb-10 pt-7"
        >
            <header>
                <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Settings</h1>
                <p className="mt-1 text-[13.5px] text-muted-foreground">
                    Organized controls for Catalyst, connections and assistant services
                </p>
            </header>

            {tokenSuccess && (
                <Alert className="border-primary/30 bg-primary/10">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-foreground">
                        Ngrok authtoken has been updated successfully.
                    </AlertDescription>
                </Alert>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Spinner className="h-6 w-6 text-muted-foreground" />
                </div>
            ) : (
                <div className="grid items-start gap-5 lg:grid-cols-[210px_1fr]">
                    <nav className="sticky top-5 rounded-2xl border border-border bg-card p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]" aria-label="Settings categories">
                        {SETTINGS_CATEGORIES.map((category) => {
                            const CategoryIcon = category.icon
                            const active = activeCategory === category.id
                            return (
                                <button
                                    key={category.id}
                                    type="button"
                                    onClick={() => setActiveCategory(category.id)}
                                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-[background-color,color,transform] duration-200 hover:translate-x-0.5 ${active ? "bg-selected text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
                                >
                                    <span className={`grid h-8 w-8 place-items-center rounded-lg border ${active ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-background"}`}>
                                        <CategoryIcon className="h-4 w-4" />
                                    </span>
                                    <span>
                                        <span className="block text-[12.5px] font-medium">{category.label}</span>
                                        <span className="mt-0.5 block text-[10.5px] text-muted-foreground">{category.detail}</span>
                                    </span>
                                </button>
                            )
                        })}
                    </nav>
                    <motion.div key={activeCategory} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="grid gap-4">
                    {activeCategory === "application" && (
                    <SettingsSection
                        icon={Palette}
                        title="Appearance"
                        description="Choose how Catalyst looks on your device"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium">Theme</p>
                                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                                    Light or dark interface
                                </p>
                            </div>
                            <Select value={theme} onValueChange={handleThemeChange}>
                                <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Select theme" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="dark">Dark</SelectItem>
                                    <SelectItem value="light">Light</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </SettingsSection>
                    )}

                    {activeCategory === "connectivity" && (
                    <SettingsSection
                        icon={Globe}
                        title="Ngrok"
                        description="Public tunnels so friends can join your local servers"
                    >
                        <div className="flex flex-col gap-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">Enable ngrok</p>
                                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                                        Allow tunnels for your servers
                                    </p>
                                </div>
                                <Switch checked={ngrokEnabled} onCheckedChange={handleToggleNgrok} />
                            </div>

                            <div className="space-y-2">
                                <p className="text-sm font-medium">Authtoken</p>
                                <div className="flex gap-2">
                                    <Input
                                        value={censoredToken || "No token configured"}
                                        disabled
                                        className="font-data flex-1 text-[12.5px]"
                                    />
                                    <Button variant="outline" onClick={() => setShowTokenDialog(true)}>
                                        Change
                                    </Button>
                                    {hasToken && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setShowRemoveDialog(true)}
                                            className="border-destructive/40 text-destructive hover:bg-destructive/10"
                                            aria-label="Remove authtoken"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Get your free authtoken at{" "}
                                    <button
                                        type="button"
                                        className="text-primary hover:underline"
                                        onClick={() =>
                                            window.context.openExternal(
                                                "https://dashboard.ngrok.com/get-started/your-authtoken"
                                            )
                                        }
                                    >
                                        dashboard.ngrok.com
                                        <ExternalLink className="ml-1 inline h-3 w-3" />
                                    </button>
                                </p>
                            </div>
                        </div>
                    </SettingsSection>
                    )}

                    {activeCategory === "assistant" && (
                    <SettingsSection
                        icon={Bot}
                        title="AI Assistant"
                        description="Optional chat help for pages, settings and server issues"
                    >
                        <div className="flex flex-col gap-5">
                            {aiSuccess && (
                                <Alert className="border-primary/30 bg-primary/10">
                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                    <AlertDescription className="text-foreground">
                                        AI assistant settings have been saved.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <p className="text-sm font-medium">Enable AI assistant</p>
                                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                                        Show the global assistant and allow provider-backed chat
                                    </p>
                                </div>
                                <Switch checked={aiEnabled} onCheckedChange={handleToggleAiEnabled} />
                            </div>

                            <div className="grid gap-3">
                                <div className="grid gap-1.5">
                                    <label className="text-[12.5px] font-medium text-foreground">Provider</label>
                                    <Select value={aiProvider} onValueChange={handleAiProviderChange}>
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
                                    <Input value={aiModel} onChange={(event) => setAiModel(event.target.value)} />
                                </div>

                                <div className="grid gap-1.5">
                                    <label className="text-[12.5px] font-medium text-foreground">Base URL</label>
                                    <Input value={aiBaseUrl} onChange={(event) => setAiBaseUrl(event.target.value)} />
                                </div>

                                <div className="grid gap-1.5">
                                    <label className="flex items-center gap-2 text-[12.5px] font-medium text-foreground">
                                        <KeyRound className="h-3.5 w-3.5" />
                                        API key
                                    </label>
                                    <Input
                                        type="password"
                                        value={aiApiKey}
                                        placeholder={aiSettings?.hasApiKey ? aiSettings.censoredApiKey || "Saved key" : "Paste provider key"}
                                        onChange={(event) => setAiApiKey(event.target.value)}
                                    />
                                    <p className="text-[12px] leading-relaxed text-muted-foreground">
                                        Requests are sent to the selected provider. The key is stored locally in Catalyst app data.
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button onClick={handleSaveAiAssistant} disabled={aiSaving}>
                                    {aiSaving ? <Spinner className="mr-2 h-4 w-4" /> : null}
                                    Save AI Settings
                                </Button>
                            </div>
                        </div>
                    </SettingsSection>
                    )}

                    {activeCategory === "application" && (
                    <SettingsSection
                        icon={ShieldAlert}
                        title="Shutdown"
                        description="Control what happens when Catalyst closes"
                    >
                        <div className="flex items-center justify-between gap-6">
                            <div>
                                <p className="text-sm font-medium">Ask before closing</p>
                                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                                    Show a confirmation before servers and tunnels are stopped on exit
                                </p>
                            </div>
                            <Switch checked={askBeforeClose} onCheckedChange={handleToggleCloseWarning} />
                        </div>
                    </SettingsSection>
                    )}

                    {activeCategory === "about" && (
                    <SettingsSection icon={Info} title="About" description="Application information">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">Version</p>
                                <p className="font-data text-[13px] text-muted-foreground">
                                    Catalyst v{__APP_VERSION__}
                                </p>
                            </div>
                            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                                Ngrok creates secure tunnels to your local servers so players from anywhere can
                                connect — each server gets its own public address like{" "}
                                <code className="font-data rounded bg-primary/10 px-1 text-primary">
                                    0.tcp.ngrok.io:12345
                                </code>
                                .
                            </p>
                        </div>
                    </SettingsSection>
                    )}
                    </motion.div>
                </div>
            )}

            {/* Change Token Dialog */}
            <AlertDialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Change ngrok authtoken</AlertDialogTitle>
                        <AlertDialogDescription>
                            Enter your new ngrok authtoken. It will be validated before being saved.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-2">
                        <Input
                            type="password"
                            placeholder="Enter your ngrok authtoken"
                            value={newToken}
                            onChange={(e) => {
                                setNewToken(e.target.value)
                                setTokenError(null)
                            }}
                        />
                        {tokenError && (
                            <p className="mt-2 text-sm text-destructive">{tokenError}</p>
                        )}
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleValidateAndSaveToken} disabled={tokenValidating}>
                            {tokenValidating ? (
                                <span className="flex items-center gap-2">
                                    <Spinner className="h-4 w-4" />
                                    Validating...
                                </span>
                            ) : (
                                "Save token"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Remove Token Confirmation Dialog */}
            <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove authtoken</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove your ngrok authtoken? You will need to enter a new
                            token to use ngrok tunnels.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleRemoveToken}
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </motion.section>
    )
}
