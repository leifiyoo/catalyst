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
import { CheckCircle2, ExternalLink, Trash2, Palette, Globe, Info } from "lucide-react"
import { getStoredTheme, setStoredTheme, type ThemeMode } from "@/utils/theme"

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
    const [censoredToken, setCensoredToken] = useState<string | null>(null)
    const [hasToken, setHasToken] = useState(false)
    const [loading, setLoading] = useState(true)

    const [showTokenDialog, setShowTokenDialog] = useState(false)
    const [showRemoveDialog, setShowRemoveDialog] = useState(false)
    const [newToken, setNewToken] = useState("")
    const [tokenValidating, setTokenValidating] = useState(false)
    const [tokenError, setTokenError] = useState<string | null>(null)
    const [tokenSuccess, setTokenSuccess] = useState(false)

    useEffect(() => {
        setTheme(getStoredTheme())
        loadNgrokSettings()
    }, [])

    const loadNgrokSettings = async () => {
        setLoading(true)
        if (!window.context) {
            setLoading(false)
            return
        }

        try {
            const [enabled, token] = await Promise.all([
                window.context.isNgrokEnabled(),
                window.context.getNgrokAuthtokenCensored()
            ])
            setNgrokEnabledState(enabled)
            setCensoredToken(token)
            setHasToken(!!token)
        } catch (error) {
            console.error("Failed to load ngrok settings:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleToggleNgrok = async (enabled: boolean) => {
        await window.context.setNgrokEnabled(enabled)
        setNgrokEnabledState(enabled)
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

        await loadNgrokSettings()
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
            className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-8 pb-10 pt-7"
        >
            <header>
                <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Settings</h1>
                <p className="mt-1 text-[13.5px] text-muted-foreground">
                    Appearance, tunneling and application info
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
                <div className="grid gap-4">
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
