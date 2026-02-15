import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    Shield,
    ShieldCheck,
    ShieldOff,
    Key,
    Trash2,
    CheckCircle2,
    AlertTriangle,
    ExternalLink,
    X,
    Globe,
    Server,
} from "lucide-react"
import type { TCPShieldProtectionStatus } from "@shared/types"

type ProtectionTabProps = {
    serverId: string
    serverName: string
}

export function ProtectionTab({ serverId, serverName }: ProtectionTabProps) {
    // API Key state
    const [apiKey, setApiKey] = useState("")
    const [apiKeyCensored, setApiKeyCensored] = useState<string | null>(null)
    const [apiKeyLoading, setApiKeyLoading] = useState(true)
    const [apiKeySaving, setApiKeySaving] = useState(false)
    const [apiKeyError, setApiKeyError] = useState<string | null>(null)

    // Protection status
    const [status, setStatus] = useState<TCPShieldProtectionStatus | null>(null)
    const [statusLoading, setStatusLoading] = useState(false)

    // Action states
    const [adding, setAdding] = useState(false)
    const [removing, setRemoving] = useState(false)
    const [toggling, setToggling] = useState(false)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    // Server address for adding protection
    const [serverAddress, setServerAddress] = useState("0.0.0.0")
    const [serverPort, setServerPort] = useState("25565")

    const loadApiKey = useCallback(async () => {
        setApiKeyLoading(true)
        try {
            const censored = await window.context.getProtectionApiKeyCensored()
            setApiKeyCensored(censored)
        } catch {
            // Ignore
        } finally {
            setApiKeyLoading(false)
        }
    }, [])

    const loadStatus = useCallback(async () => {
        if (!apiKeyCensored) return
        setStatusLoading(true)
        try {
            const result = await window.context.getProtectionStatus(serverId)
            setStatus(result)
        } catch {
            setStatus(null)
        } finally {
            setStatusLoading(false)
        }
    }, [serverId, apiKeyCensored])

    useEffect(() => {
        loadApiKey()
    }, [loadApiKey])

    useEffect(() => {
        if (apiKeyCensored) {
            loadStatus()
        }
    }, [apiKeyCensored, loadStatus])

    const showSuccess = (msg: string) => {
        setSuccessMessage(msg)
        setTimeout(() => setSuccessMessage(null), 4000)
    }

    const showError = (msg: string) => {
        setErrorMessage(msg)
        setTimeout(() => setErrorMessage(null), 6000)
    }

    const handleSaveApiKey = async () => {
        if (!apiKey.trim()) return
        setApiKeySaving(true)
        setApiKeyError(null)
        try {
            const result = await window.context.validateProtectionApiKey(apiKey.trim())
            if (!result.valid) {
                setApiKeyError(result.error || "Invalid API key")
                setApiKeySaving(false)
                return
            }
            await window.context.setProtectionApiKey(apiKey.trim())
            setApiKey("")
            await loadApiKey()
            showSuccess("API key saved successfully")
        } catch (err) {
            setApiKeyError(err instanceof Error ? err.message : "Failed to save API key")
        } finally {
            setApiKeySaving(false)
        }
    }

    const handleRemoveApiKey = async () => {
        try {
            await window.context.removeProtectionApiKey()
            setApiKeyCensored(null)
            setStatus(null)
            showSuccess("API key removed")
        } catch {
            showError("Failed to remove API key")
        }
    }

    const handleAddProtection = async () => {
        setAdding(true)
        try {
            const port = parseInt(serverPort, 10) || 25565
            const result = await window.context.addServerProtection(
                serverId,
                serverName,
                serverAddress,
                port
            )
            if (result.success) {
                showSuccess("Server added to TCPShield protection")
                await loadStatus()
            } else {
                showError(result.error || "Failed to add protection")
            }
        } catch (err) {
            showError(err instanceof Error ? err.message : "Failed to add protection")
        } finally {
            setAdding(false)
        }
    }

    const handleRemoveProtection = async () => {
        setRemoving(true)
        try {
            const result = await window.context.removeServerProtection(serverId)
            if (result.success) {
                showSuccess("Server removed from TCPShield protection")
                await loadStatus()
            } else {
                showError(result.error || "Failed to remove protection")
            }
        } catch (err) {
            showError(err instanceof Error ? err.message : "Failed to remove protection")
        } finally {
            setRemoving(false)
        }
    }

    const handleToggleProtection = async () => {
        if (!status) return
        setToggling(true)
        try {
            const result = status.enabled
                ? await window.context.disableProtection(serverId)
                : await window.context.enableProtection(serverId)
            if (result.success) {
                showSuccess(status.enabled ? "Protection disabled" : "Protection enabled")
                await loadStatus()
            } else {
                showError(result.error || "Failed to toggle protection")
            }
        } catch (err) {
            showError(err instanceof Error ? err.message : "Failed to toggle protection")
        } finally {
            setToggling(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Success/Error Alerts */}
            {successMessage && (
                <div className="fixed bottom-6 right-6 z-50 w-[380px] animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <Alert className="border-primary/40 bg-primary/10 text-primary shadow-xl">
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertTitle>Success</AlertTitle>
                        <AlertDescription>{successMessage}</AlertDescription>
                    </Alert>
                </div>
            )}
            {errorMessage && (
                <div className="fixed bottom-6 right-6 z-50 w-[380px] animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <Alert className="border-destructive/40 bg-destructive/10 text-destructive shadow-xl">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                </div>
            )}

            {/* Section: API Key */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                    <Shield className="h-5 w-5 text-blue-500" />
                    <h3 className="text-lg font-semibold tracking-tight">TCPShield DDoS Protection</h3>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Key className="h-4 w-4" />
                            API Key
                        </CardTitle>
                        <CardDescription>
                            Connect your TCPShield account to enable DDoS protection.{" "}
                            <button
                                className="text-primary hover:underline inline-flex items-center gap-1"
                                onClick={() => window.context.openExternal("https://panel.tcpshield.com")}
                            >
                                Get your API key
                                <ExternalLink className="h-3 w-3" />
                            </button>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        {apiKeyLoading ? (
                            <div className="flex justify-center py-4">
                                <Spinner />
                            </div>
                        ) : apiKeyCensored ? (
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-md flex items-center justify-center bg-primary/10 text-primary">
                                        <Key className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium">API Key Configured</div>
                                        <div className="text-xs text-muted-foreground font-mono">
                                            {apiKeyCensored}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                    onClick={handleRemoveApiKey}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        type="password"
                                        placeholder="Enter your TCPShield API key"
                                        value={apiKey}
                                        onChange={(e) => {
                                            setApiKey(e.target.value)
                                            setApiKeyError(null)
                                        }}
                                        className="font-mono text-xs"
                                    />
                                    <Button
                                        onClick={handleSaveApiKey}
                                        disabled={!apiKey.trim() || apiKeySaving}
                                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                                    >
                                        {apiKeySaving ? <Spinner className="h-4 w-4" /> : "Save"}
                                    </Button>
                                </div>
                                {apiKeyError && (
                                    <p className="text-xs text-destructive flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        {apiKeyError}
                                    </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    Free tier supports 1 server and 1 domain.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Section: Protection Status */}
            {apiKeyCensored && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                        {status?.enabled ? (
                            <ShieldCheck className="h-5 w-5 text-green-500" />
                        ) : (
                            <ShieldOff className="h-5 w-5 text-muted-foreground" />
                        )}
                        <h3 className="text-lg font-semibold tracking-tight">Server Protection</h3>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        {/* Status Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Protection Status</CardTitle>
                                <CardDescription>
                                    Current TCPShield protection state for this server
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-4">
                                {statusLoading ? (
                                    <div className="flex justify-center py-4">
                                        <Spinner />
                                    </div>
                                ) : status?.configured ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                            <span className="text-muted-foreground text-sm">Status</span>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    status.enabled
                                                        ? "bg-green-500/10 text-green-600 border-green-500/20"
                                                        : "bg-muted text-muted-foreground border-border"
                                                }
                                            >
                                                {status.enabled ? "Protected" : "Disabled"}
                                            </Badge>
                                        </div>
                                        {status.networkName && (
                                            <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                                <span className="text-muted-foreground text-sm flex items-center gap-1.5">
                                                    <Server className="h-3.5 w-3.5" />
                                                    Network
                                                </span>
                                                <span className="text-sm font-medium">{status.networkName}</span>
                                            </div>
                                        )}
                                        {status.domainName && (
                                            <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                                <span className="text-muted-foreground text-sm flex items-center gap-1.5">
                                                    <Globe className="h-3.5 w-3.5" />
                                                    Domain
                                                </span>
                                                <span className="text-sm font-medium font-mono text-xs">{status.domainName}</span>
                                            </div>
                                        )}
                                        {status.backendAddress && (
                                            <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                                <span className="text-muted-foreground text-sm">Backend</span>
                                                <span className="text-sm font-medium font-mono text-xs">{status.backendAddress}</span>
                                            </div>
                                        )}
                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1"
                                                onClick={handleToggleProtection}
                                                disabled={toggling}
                                            >
                                                {toggling ? (
                                                    <Spinner className="h-4 w-4 mr-2" />
                                                ) : status.enabled ? (
                                                    <ShieldOff className="h-4 w-4 mr-2" />
                                                ) : (
                                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                                )}
                                                {status.enabled ? "Disable" : "Enable"}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="border-destructive/50 text-destructive hover:bg-destructive/10"
                                                onClick={handleRemoveProtection}
                                                disabled={removing}
                                            >
                                                {removing ? (
                                                    <Spinner className="h-4 w-4 mr-2" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                )}
                                                Remove
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2 bg-muted/50 rounded-lg border border-dashed border-border">
                                        <ShieldOff className="h-8 w-8 opacity-20" />
                                        <p className="text-sm">No protection configured</p>
                                        <p className="text-xs text-muted-foreground/60">
                                            Add this server to TCPShield to get started
                                        </p>
                                    </div>
                                )}
                                {status?.error && (
                                    <p className="text-xs text-destructive flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        {status.error}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Add Protection Card */}
                        {!status?.configured && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Add Protection</CardTitle>
                                    <CardDescription>
                                        Configure TCPShield for this server
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-4">
                                    <div className="grid gap-3">
                                        <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                            Server Address
                                        </label>
                                        <Input
                                            placeholder="Your server IP (e.g. 123.45.67.89)"
                                            value={serverAddress}
                                            onChange={(e) => setServerAddress(e.target.value)}
                                            className="font-mono text-xs"
                                        />
                                    </div>
                                    <div className="grid gap-3">
                                        <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                            Server Port
                                        </label>
                                        <Input
                                            type="number"
                                            placeholder="25565"
                                            value={serverPort}
                                            onChange={(e) => setServerPort(e.target.value)}
                                            className="font-mono text-xs w-32"
                                        />
                                    </div>
                                    <Button
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                        onClick={handleAddProtection}
                                        disabled={adding || !serverAddress.trim()}
                                    >
                                        {adding ? (
                                            <Spinner className="h-4 w-4 mr-2" />
                                        ) : (
                                            <ShieldCheck className="h-4 w-4 mr-2" />
                                        )}
                                        Enable TCPShield Protection
                                    </Button>
                                    <p className="text-xs text-muted-foreground text-center">
                                        This will create a TCPShield network, domain, and backend for your server.
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
