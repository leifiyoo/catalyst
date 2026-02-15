import { useState, useEffect } from "react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, ExternalLink, Trash2, Shield, ShieldCheck, ShieldX } from "lucide-react"
import type { TCPShieldStatus } from "@shared/types"

export function TCPShieldSettings() {
    const [loading, setLoading] = useState(true)
    const [enabled, setEnabled] = useState(false)
    const [debug, setDebug] = useState(false)
    const [censoredKey, setCensoredKey] = useState<string | null>(null)
    const [hasKey, setHasKey] = useState(false)
    const [status, setStatus] = useState<TCPShieldStatus | null>(null)
    const [statusLoading, setStatusLoading] = useState(false)

    // Dialog states
    const [showKeyDialog, setShowKeyDialog] = useState(false)
    const [showRemoveDialog, setShowRemoveDialog] = useState(false)
    const [newKey, setNewKey] = useState("")
    const [keyValidating, setKeyValidating] = useState(false)
    const [keyError, setKeyError] = useState<string | null>(null)
    const [keySuccess, setKeySuccess] = useState(false)

    useEffect(() => {
        loadSettings()
    }, [])

    const loadSettings = async () => {
        setLoading(true)
        try {
            const [config, censored] = await Promise.all([
                window.context.tcpshieldGetConfig(),
                window.context.tcpshieldGetApiKeyCensored(),
            ])
            if (config) {
                setEnabled(config.enabled)
                setDebug(config.debug)
            }
            setCensoredKey(censored)
            setHasKey(!!censored)

            // Load status if key is configured
            if (censored) {
                await refreshStatus()
            }
        } catch (error) {
            console.error("Failed to load TCPShield settings:", error)
        } finally {
            setLoading(false)
        }
    }

    const refreshStatus = async () => {
        setStatusLoading(true)
        try {
            const s = await window.context.tcpshieldGetStatus()
            setStatus(s)
        } catch (error) {
            console.error("Failed to get TCPShield status:", error)
        } finally {
            setStatusLoading(false)
        }
    }

    const handleToggleEnabled = async (value: boolean) => {
        if (value) {
            const result = await window.context.tcpshieldEnable("")
            if (result.success) {
                setEnabled(true)
            }
        } else {
            const result = await window.context.tcpshieldDisable("")
            if (result.success) {
                setEnabled(false)
            }
        }
    }

    const handleToggleDebug = async (value: boolean) => {
        await window.context.tcpshieldSetConfig({ debug: value })
        setDebug(value)
    }

    const handleSaveKey = async () => {
        if (!newKey.trim()) {
            setKeyError("Please enter an API key")
            return
        }

        setKeyValidating(true)
        setKeyError(null)

        const result = await window.context.tcpshieldSetApiKey(newKey.trim())
        if (!result.success) {
            setKeyError(result.error || "Failed to validate API key")
            setKeyValidating(false)
            return
        }

        setKeyValidating(false)
        setShowKeyDialog(false)
        setNewKey("")
        setKeySuccess(true)
        setTimeout(() => setKeySuccess(false), 3000)

        await loadSettings()
    }

    const handleRemoveKey = async () => {
        const result = await window.context.tcpshieldRemoveApiKey()
        if (result.success) {
            setShowRemoveDialog(false)
            setCensoredKey(null)
            setHasKey(false)
            setEnabled(false)
            setStatus(null)
        } else {
            console.error("Failed to remove API key:", result.error)
        }
    }

    return (
        <>
            {keySuccess && (
                <Alert className="border-primary/40 bg-primary/10">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <AlertTitle className="text-primary">Success</AlertTitle>
                    <AlertDescription className="text-muted-foreground">
                        TCPShield API key has been updated successfully.
                    </AlertDescription>
                </Alert>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Spinner className="h-8 w-8 text-primary" />
                </div>
            ) : (
                <>
                    {/* TCPShield Settings Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-primary" />
                                TCPShield DDoS Protection
                            </CardTitle>
                            <CardDescription>
                                Configure TCPShield to protect your servers from DDoS attacks
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Enable/Disable Toggle */}
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="font-medium">Enable TCPShield</p>
                                    <p className="text-sm text-muted-foreground">
                                        Activate DDoS protection for your servers
                                    </p>
                                </div>
                                <Switch
                                    checked={enabled}
                                    onCheckedChange={handleToggleEnabled}
                                    disabled={!hasKey}
                                    className="data-[state=checked]:bg-primary"
                                />
                            </div>

                            {/* Debug Toggle */}
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="font-medium">Debug Logging</p>
                                    <p className="text-sm text-muted-foreground">
                                        Enable verbose logging for troubleshooting
                                    </p>
                                </div>
                                <Switch
                                    checked={debug}
                                    onCheckedChange={handleToggleDebug}
                                    className="data-[state=checked]:bg-primary"
                                />
                            </div>

                            {/* API Key Section */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">API Key</label>
                                <div className="flex gap-2">
                                    <Input
                                        value={censoredKey || "No API key configured"}
                                        disabled
                                        className="flex-1"
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowKeyDialog(true)}
                                    >
                                        Change
                                    </Button>
                                    {hasKey && (
                                        <Button
                                            variant="outline"
                                            onClick={() => setShowRemoveDialog(true)}
                                            className="border-destructive/40 text-destructive hover:bg-destructive/10"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Get your API key at{" "}
                                    <a
                                        href="#"
                                        className="text-primary hover:underline"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            window.context.openExternal("https://panel.tcpshield.com/settings/api")
                                        }}
                                    >
                                        panel.tcpshield.com
                                        <ExternalLink className="h-3 w-3 inline ml-1" />
                                    </a>
                                </p>
                            </div>

                            {/* Status Display */}
                            {hasKey && (
                                <div className="space-y-3 rounded-lg border border-border p-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium">Protection Status</p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={refreshStatus}
                                            disabled={statusLoading}
                                        >
                                            {statusLoading ? (
                                                <Spinner className="h-4 w-4" />
                                            ) : (
                                                "Refresh"
                                            )}
                                        </Button>
                                    </div>

                                    {status ? (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                {status.connected ? (
                                                    <ShieldCheck className="h-4 w-4 text-green-500" />
                                                ) : (
                                                    <ShieldX className="h-4 w-4 text-destructive" />
                                                )}
                                                <span className="text-sm">
                                                    {status.connected ? "Connected" : "Disconnected"}
                                                </span>
                                                <Badge variant={status.enabled ? "default" : "secondary"}>
                                                    {status.enabled ? "Enabled" : "Disabled"}
                                                </Badge>
                                            </div>
                                            {status.networkName && (
                                                <p className="text-sm text-muted-foreground">
                                                    Network: <span className="text-foreground">{status.networkName}</span>
                                                </p>
                                            )}
                                            {status.backends.length > 0 && (
                                                <div className="space-y-1">
                                                    <p className="text-xs text-muted-foreground">Backends:</p>
                                                    {status.backends.map((b) => (
                                                        <div key={b.id} className="flex items-center gap-2 text-xs">
                                                            <span className={`h-2 w-2 rounded-full ${b.online ? "bg-green-500" : "bg-muted-foreground"}`} />
                                                            <span>{b.address}:{b.port}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {status.error && (
                                                <p className="text-sm text-destructive">{status.error}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            Click refresh to check status
                                        </p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Info Card */}
                    <Card className="bg-card/70">
                        <CardContent className="pt-6">
                            <div className="flex gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                                    <Shield className="h-5 w-5 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium text-foreground/80">About TCPShield</p>
                                    <p className="text-sm text-muted-foreground">
                                        TCPShield provides enterprise-grade DDoS protection for Minecraft servers.
                                        It acts as a reverse proxy, filtering malicious traffic before it reaches your server.
                                        Configure your API key to manage networks and backends directly from Catalyst.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Change API Key Dialog */}
            <AlertDialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
                <AlertDialogContent className="border-border bg-popover">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Set TCPShield API Key</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            Enter your TCPShield API key. It will be validated before being saved.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <Input
                            type="password"
                            placeholder="Enter your TCPShield API key"
                            value={newKey}
                            onChange={(e) => {
                                setNewKey(e.target.value)
                                setKeyError(null)
                            }}
                        />
                        {keyError && (
                            <p className="text-sm text-destructive mt-2">{keyError}</p>
                        )}
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-border bg-transparent text-foreground hover:bg-muted">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleSaveKey}
                            disabled={keyValidating}
                        >
                            {keyValidating ? (
                                <span className="flex items-center gap-2">
                                    <Spinner className="h-4 w-4" />
                                    Validating...
                                </span>
                            ) : (
                                "Save Key"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Remove Key Confirmation Dialog */}
            <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
                <AlertDialogContent className="border-border bg-popover">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove API Key</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            Are you sure you want to remove your TCPShield API key? Protection will be disabled.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-border bg-transparent text-foreground hover:bg-muted">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleRemoveKey}
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
