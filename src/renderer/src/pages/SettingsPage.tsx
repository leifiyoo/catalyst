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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { CheckCircle2, ExternalLink, Trash2 } from "lucide-react"
import { getStoredTheme, setStoredTheme, type ThemeMode } from "@/utils/theme"

export function SettingsPage() {
    const [theme, setTheme] = useState<ThemeMode>("dark")
    // Ngrok settings state
    const [ngrokEnabled, setNgrokEnabledState] = useState(true)
    const [censoredToken, setCensoredToken] = useState<string | null>(null)
    const [hasToken, setHasToken] = useState(false)
    const [loading, setLoading] = useState(true)
    
    // Dialog states
    const [showTokenDialog, setShowTokenDialog] = useState(false)
    const [showRemoveDialog, setShowRemoveDialog] = useState(false)
    const [newToken, setNewToken] = useState("")
    const [tokenValidating, setTokenValidating] = useState(false)
    const [tokenError, setTokenError] = useState<string | null>(null)
    const [tokenSuccess, setTokenSuccess] = useState(false)
    
    // Load ngrok settings on mount
    useEffect(() => {
        setTheme(getStoredTheme())
        loadNgrokSettings()
    }, [])
    
    const loadNgrokSettings = async () => {
        setLoading(true)
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
        
        // Validate the token (this also installs ngrok if needed)
        const validationResult = await window.context.validateNgrokAuthtoken(newToken.trim())
        if (!validationResult.valid) {
            setTokenError(validationResult.error || "Invalid authtoken")
            setTokenValidating(false)
            return
        }
        
        // Token is valid, configure it (this also installs ngrok if needed)
        const configureResult = await window.context.configureNgrokAuthtoken(newToken.trim())
        if (!configureResult.success) {
            setTokenError(configureResult.error || "Failed to save authtoken")
            setTokenValidating(false)
            return
        }
        
        // Success
        setTokenValidating(false)
        setShowTokenDialog(false)
        setNewToken("")
        setTokenSuccess(true)
        setTimeout(() => setTokenSuccess(false), 3000)
        
        // Reload settings
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
        <section className="flex flex-col gap-6 px-10 pb-10 pt-6">
            <header>
                <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
                    Application
                </p>
                <h1 className="mt-2 text-3xl font-semibold">Settings</h1>
            </header>
            
            {tokenSuccess && (
                <Alert className="border-primary/40 bg-primary/10">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <AlertTitle className="text-primary">Success</AlertTitle>
                    <AlertDescription className="text-muted-foreground">
                        Ngrok authtoken has been updated successfully.
                    </AlertDescription>
                </Alert>
            )}
            
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Spinner className="h-8 w-8 text-primary" />
                </div>
            ) : (
                <div className="grid gap-6">
                    {/* Appearance Settings Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-primary">
                                    <path d="M12 3a9 9 0 1 0 9 9" />
                                    <path d="M12 3v9l6.75 6.75" />
                                </svg>
                                Appearance
                            </CardTitle>
                            <CardDescription>
                                Choose how Catalyst looks on your device
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="font-medium">Theme</p>
                                    <p className="text-sm text-muted-foreground">
                                        Choose light or dark mode for the app
                                    </p>
                                </div>
                                <Select value={theme} onValueChange={handleThemeChange}>
                                    <SelectTrigger className="w-44">
                                        <SelectValue placeholder="Select theme" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="dark">Dark mode</SelectItem>
                                        <SelectItem value="light">Light mode</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Ngrok Settings Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-primary">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                </svg>
                                Ngrok Settings
                            </CardTitle>
                            <CardDescription>
                                Configure ngrok for public server access
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Enable/Disable Toggle */}
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="font-medium">Enable Ngrok</p>
                                    <p className="text-sm text-muted-foreground">
                                        Allow ngrok tunnels for your servers
                                    </p>
                                </div>
                                <Switch
                                    checked={ngrokEnabled}
                                    onCheckedChange={handleToggleNgrok}
                                    className="data-[state=checked]:bg-primary"
                                />
                            </div>
                            
                            {/* Token Section */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Authtoken</label>
                                <div className="flex gap-2">
                                    <Input
                                        value={censoredToken || "No token configured"}
                                        disabled
                                        className="flex-1"
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowTokenDialog(true)}
                                    >
                                        Change
                                    </Button>
                                    {hasToken && (
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
                                    Get your free authtoken at{" "}
                                    <a
                                        href="#"
                                        className="text-primary hover:underline"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            window.context.openExternal("https://dashboard.ngrok.com/get-started/your-authtoken")
                                        }}
                                    >
                                        dashboard.ngrok.com
                                        <ExternalLink className="h-3 w-3 inline ml-1" />
                                    </a>
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    
                    {/* Info Card */}
                    <Card className="bg-card/70">
                        <CardContent className="pt-6">
                            <div className="flex gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-primary">
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="M12 16v-4"/>
                                        <path d="M12 8h.01"/>
                                    </svg>
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium text-foreground/80">About Ngrok</p>
                                    <p className="text-sm text-muted-foreground">
                                        Ngrok creates secure tunnels to your local servers, allowing players from anywhere in the world to connect to your Minecraft server. 
                                        Each server can have its own ngrok tunnel, giving you a public address like <code className="text-primary bg-primary/10 px-1 rounded">0.tcp.ngrok.io:12345</code>.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    {/* Version Info Card */}
                    <Card className="bg-card/70">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="font-medium text-foreground/80">Version</p>
                                    <p className="text-sm text-muted-foreground">
                                        Catalyst v{__APP_VERSION__}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
            
            {/* Change Token Dialog */}
            <AlertDialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
                <AlertDialogContent className="border-border bg-popover">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Change Ngrok Authtoken</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            Enter your new ngrok authtoken. It will be validated before being saved.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
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
                            <p className="text-sm text-destructive mt-2">{tokenError}</p>
                        )}
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-border bg-transparent text-foreground hover:bg-muted">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleValidateAndSaveToken}
                            disabled={tokenValidating}
                        >
                            {tokenValidating ? (
                                <span className="flex items-center gap-2">
                                    <Spinner className="h-4 w-4" />
                                    Validating...
                                </span>
                            ) : (
                                "Save Token"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            {/* Remove Token Confirmation Dialog */}
            <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
                <AlertDialogContent className="border-border bg-popover">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Authtoken</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            Are you sure you want to remove your ngrok authtoken? You will need to enter a new token to use ngrok tunnels.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-border bg-transparent text-foreground hover:bg-muted">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleRemoveToken}
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    )
}
