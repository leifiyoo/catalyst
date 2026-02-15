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
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Copy,
    ExternalLink,
    Plus,
    RotateCcw,
    Shield,
    ShieldCheck,
    Trash2,
} from "lucide-react"
import type { TCPShieldTutorialConfig, TCPShieldTutorialStep, TCPShieldBackendEntry } from "@shared/types"

// ---- Validation helpers ----

const CNAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/
const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/
const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/

function isValidCname(value: string): boolean {
    return CNAME_REGEX.test(value.trim())
}

function isValidDomain(value: string): boolean {
    return DOMAIN_REGEX.test(value.trim())
}

function isValidAddress(value: string): boolean {
    const trimmed = value.trim()
    // Accept IPv4, hostname, or domain
    return IPV4_REGEX.test(trimmed) || DOMAIN_REGEX.test(trimmed)
}

function isValidPort(value: string): boolean {
    const num = parseInt(value, 10)
    return !isNaN(num) && num >= 1 && num <= 65535
}

export function TCPShieldTutorial() {
    const [loading, setLoading] = useState(true)
    const [config, setConfig] = useState<TCPShieldTutorialConfig | null>(null)
    const [steps, setSteps] = useState<TCPShieldTutorialStep[]>([])
    const [currentStep, setCurrentStep] = useState(0)
    const [inputValues, setInputValues] = useState<Record<string, string>>({})
    const [backends, setBackends] = useState<TCPShieldBackendEntry[]>([])
    const [newBackendAddress, setNewBackendAddress] = useState("")
    const [newBackendPort, setNewBackendPort] = useState("25565")
    const [saving, setSaving] = useState(false)
    const [copied, setCopied] = useState(false)
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const [tutorialConfig, tutorialSteps] = await Promise.all([
                window.context.tcpshieldGetTutorialConfig(),
                window.context.tcpshieldGetTutorialSteps(),
            ])
            setConfig(tutorialConfig)
            setSteps(tutorialSteps)
            setCurrentStep(tutorialConfig.currentStep)
            setBackends(tutorialConfig.backends || [])
            setInputValues({
                protectedCname: tutorialConfig.protectedCname || "",
                domain: tutorialConfig.domain || "",
            })
        } catch (error) {
            console.error("Failed to load tutorial data:", error)
        } finally {
            setLoading(false)
        }
    }

    const saveProgress = async (step: number, extraConfig?: Partial<TCPShieldTutorialConfig>) => {
        setSaving(true)
        try {
            const update: Partial<TCPShieldTutorialConfig> = {
                currentStep: step,
                ...extraConfig,
            }
            await window.context.tcpshieldSetTutorialConfig(update)
            setConfig((prev) => prev ? { ...prev, ...update } : prev)
        } catch (error) {
            console.error("Failed to save tutorial progress:", error)
        } finally {
            setSaving(false)
        }
    }

    const validateCurrentStep = (): boolean => {
        const step = steps[currentStep]
        const errors: Record<string, string> = {}

        if (step?.inputField === "protectedCname") {
            const val = inputValues.protectedCname?.trim()
            if (val && !isValidCname(val)) {
                errors.protectedCname = "Enter a valid CNAME (e.g. xxxxxxxx.tcpshield.com)"
            }
        }

        if (step?.inputField === "domain") {
            const val = inputValues.domain?.trim()
            if (val && !isValidDomain(val)) {
                errors.domain = "Enter a valid domain (e.g. mc.example.com)"
            }
        }

        if (step?.inputField === "backendAddress") {
            // Backends are validated when adding, not on next
        }

        setValidationErrors(errors)
        return Object.keys(errors).length === 0
    }

    const handleNext = async () => {
        if (currentStep >= steps.length - 1) return
        if (!validateCurrentStep()) return

        const step = steps[currentStep]
        const extraConfig: Partial<TCPShieldTutorialConfig> = {}

        if (step?.inputField === "protectedCname") {
            extraConfig.protectedCname = inputValues.protectedCname?.trim() || ""
        }
        if (step?.inputField === "domain") {
            extraConfig.domain = inputValues.domain?.trim() || ""
        }
        if (step?.inputField === "backendAddress") {
            extraConfig.backends = backends
            // Keep legacy fields in sync with first backend
            if (backends.length > 0) {
                extraConfig.backendAddress = backends[0].address
                extraConfig.backendPort = backends[0].port
            }
        }

        const nextStep = currentStep + 1
        setCurrentStep(nextStep)
        setValidationErrors({})
        await saveProgress(nextStep, extraConfig)
    }

    const handlePrevious = () => {
        if (currentStep <= 0) return
        const prevStep = currentStep - 1
        setCurrentStep(prevStep)
        setValidationErrors({})
        saveProgress(prevStep)
    }

    const handleReset = async () => {
        await window.context.tcpshieldResetTutorial()
        setCurrentStep(0)
        setInputValues({
            protectedCname: "",
            domain: "",
        })
        setBackends([])
        setNewBackendAddress("")
        setNewBackendPort("25565")
        setValidationErrors({})
        await loadData()
    }

    const handleAddBackend = () => {
        const address = newBackendAddress.trim()
        const port = newBackendPort.trim() || "25565"

        const errors: Record<string, string> = {}
        if (!address) {
            errors.newBackendAddress = "Server address is required"
        } else if (!isValidAddress(address)) {
            errors.newBackendAddress = "Enter a valid IP (e.g. 123.45.67.89) or hostname"
        }
        if (!isValidPort(port)) {
            errors.newBackendPort = "Port must be between 1 and 65535"
        }

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors)
            return
        }

        const portNum = parseInt(port, 10)
        // Check for duplicates
        const exists = backends.some(b => b.address === address && b.port === portNum)
        if (exists) {
            setValidationErrors({ newBackendAddress: "This backend already exists" })
            return
        }

        const updated = [...backends, { address, port: portNum }]
        setBackends(updated)
        setNewBackendAddress("")
        setNewBackendPort("25565")
        setValidationErrors({})
    }

    const handleRemoveBackend = (index: number) => {
        setBackends((prev) => prev.filter((_, i) => i !== index))
    }

    const handleCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // Fallback: select text approach not needed in Electron
            console.error("Failed to copy to clipboard")
        }
    }

    const handleOpenExternal = (url: string) => {
        window.context.openExternal(url)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Spinner className="h-8 w-8 text-primary" />
            </div>
        )
    }

    const step = steps[currentStep]
    const isCompleted = config?.tutorialStatus === "completed"
    const totalSteps = steps.length

    // Determine the player-facing address
    const playerAddress = config?.domain || config?.protectedCname || ""

    return (
        <>
            {/* Main Tutorial Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            {isCompleted ? (
                                <ShieldCheck className="h-5 w-5 text-green-500" />
                            ) : (
                                <Shield className="h-5 w-5 text-primary" />
                            )}
                            TCPShield Setup
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Badge variant={isCompleted ? "default" : "secondary"}>
                                {isCompleted
                                    ? "Completed"
                                    : `Step ${currentStep + 1} of ${totalSteps}`}
                            </Badge>
                            {(config?.tutorialStatus === "in-progress" || isCompleted) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleReset}
                                    title="Reset tutorial"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                    <CardDescription>
                        Step-by-step guide to setting up TCPShield DDoS protection
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex gap-1">
                            {steps.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                                        idx < currentStep
                                            ? "bg-green-500"
                                            : idx === currentStep
                                              ? "bg-primary"
                                              : "bg-muted"
                                    }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Step Content */}
                    {step && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-lg font-semibold">
                                    {step.title}
                                </h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {step.description}
                                </p>
                            </div>

                            {/* Instructions */}
                            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                                {step.instructions.map((instruction, idx) => (
                                    <p
                                        key={idx}
                                        className={`text-sm ${
                                                instruction === ""
                                                    ? "h-2"
                                                    : instruction.startsWith("  →")
                                                      ? "pl-4 text-muted-foreground font-mono text-xs"
                                                      : instruction.startsWith("Don't have") || instruction.startsWith("Tip:") || instruction.startsWith("Note:")
                                                        ? "text-primary italic"
                                                        : "text-foreground"
                                            }`}
                                        >
                                            {instruction !== "" && (
                                                <>
                                                    {!instruction.startsWith("  →") &&
                                                        !instruction.startsWith("Don't have") &&
                                                        !instruction.startsWith("Tip:") &&
                                                        !instruction.startsWith("Note:") &&
                                                        instruction !== "" && (
                                                        <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                                                            {idx + 1}
                                                        </span>
                                                    )}
                                                {instruction}
                                            </>
                                        )}
                                    </p>
                                ))}
                            </div>

                            {/* Input: Protected CNAME */}
                            {step.hasInput && step.inputField === "protectedCname" && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">
                                        {step.inputLabel}
                                    </label>
                                    <Input
                                        placeholder={step.inputPlaceholder}
                                        value={inputValues.protectedCname || ""}
                                        onChange={(e) => {
                                            setInputValues((prev) => ({
                                                ...prev,
                                                protectedCname: e.target.value,
                                            }))
                                            setValidationErrors((prev) => {
                                                const { protectedCname: _, ...rest } = prev
                                                return rest
                                            })
                                        }}
                                    />
                                    {validationErrors.protectedCname && (
                                        <p className="text-xs text-red-500">{validationErrors.protectedCname}</p>
                                    )}
                                </div>
                            )}

                            {/* Input: Domain */}
                            {step.hasInput && step.inputField === "domain" && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">
                                        {step.inputLabel}
                                    </label>
                                    <Input
                                        placeholder={step.inputPlaceholder}
                                        value={inputValues.domain || ""}
                                        onChange={(e) => {
                                            setInputValues((prev) => ({
                                                ...prev,
                                                domain: e.target.value,
                                            }))
                                            setValidationErrors((prev) => {
                                                const { domain: _, ...rest } = prev
                                                return rest
                                            })
                                        }}
                                    />
                                    {validationErrors.domain && (
                                        <p className="text-xs text-red-500">{validationErrors.domain}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        Optional — if you don&apos;t have one yet, you can get one and come back.
                                    </p>
                                </div>
                            )}

                            {/* Input: Backend Servers (multi) */}
                            {step.hasInput && step.inputField === "backendAddress" && (
                                <div className="space-y-3">
                                    {/* Existing backends list */}
                                    {backends.length > 0 && (
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">
                                                Added Backends
                                            </label>
                                            {backends.map((backend, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
                                                >
                                                    <code className="flex-1 text-sm text-foreground">
                                                        {backend.address}:{backend.port}
                                                    </code>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleRemoveBackend(idx)}
                                                        title="Remove backend"
                                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Add new backend */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">
                                            {backends.length > 0 ? "Add Another Server" : "Server IP"}
                                        </label>
                                        <div className="flex gap-2">
                                            <div className="flex-1 space-y-1">
                                                <Input
                                                    placeholder={step.inputPlaceholder}
                                                    value={newBackendAddress}
                                                    onChange={(e) => {
                                                        setNewBackendAddress(e.target.value)
                                                        setValidationErrors((prev) => {
                                                            const { newBackendAddress: _, ...rest } = prev
                                                            return rest
                                                        })
                                                    }}
                                                />
                                                {validationErrors.newBackendAddress && (
                                                    <p className="text-xs text-red-500">{validationErrors.newBackendAddress}</p>
                                                )}
                                            </div>
                                            <div className="w-24 space-y-1">
                                                <Input
                                                    type="number"
                                                    placeholder="25565"
                                                    value={newBackendPort}
                                                    onChange={(e) => {
                                                        setNewBackendPort(e.target.value)
                                                        setValidationErrors((prev) => {
                                                            const { newBackendPort: _, ...rest } = prev
                                                            return rest
                                                        })
                                                    }}
                                                />
                                                {validationErrors.newBackendPort && (
                                                    <p className="text-xs text-red-500">{validationErrors.newBackendPort}</p>
                                                )}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleAddBackend}
                                                className="h-9 gap-1"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Add
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* External Link Button */}
                            {step.hasExternalLink && step.externalLinkUrl && (
                                <Button
                                    variant="outline"
                                    onClick={() => handleOpenExternal(step.externalLinkUrl!)}
                                    className="gap-2"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    {step.externalLinkLabel || "Open link"}
                                </Button>
                            )}

                            {/* Completion Summary */}
                            {isCompleted && currentStep === totalSteps - 1 && (
                                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        <p className="font-medium text-green-500">
                                            Setup complete!
                                        </p>
                                    </div>
                                    {playerAddress && (
                                        <div className="space-y-1">
                                            <p className="text-sm text-muted-foreground">
                                                Players connect via:
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <code className="flex-1 rounded bg-primary/10 px-2 py-1.5 text-sm font-medium text-primary">
                                                    {playerAddress}
                                                </code>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleCopy(playerAddress)}
                                                    className="gap-1.5 shrink-0"
                                                >
                                                    {copied ? (
                                                        <>
                                                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                                            Copied
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="h-3.5 w-3.5" />
                                                            Copy
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    {backends.length > 0 && (
                                        <div className="space-y-1">
                                            <p className="text-sm text-muted-foreground">
                                                {backends.length === 1 ? "Backend:" : "Backends:"}
                                            </p>
                                            {backends.map((b, idx) => (
                                                <code
                                                    key={idx}
                                                    className="block rounded bg-primary/10 px-2 py-1 text-sm text-primary"
                                                >
                                                    {b.address}:{b.port}
                                                </code>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex items-center justify-between pt-2">
                        <Button
                            variant="outline"
                            onClick={handlePrevious}
                            disabled={currentStep <= 0 || saving}
                            className="gap-1"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Back
                        </Button>

                        {currentStep < totalSteps - 1 ? (
                            <Button
                                onClick={handleNext}
                                disabled={saving}
                                className="gap-1"
                            >
                                {saving ? (
                                    <Spinner className="h-4 w-4" />
                                ) : (
                                    <>
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        ) : !isCompleted ? (
                            <Button
                                onClick={async () => {
                                    const extraConfig: Partial<TCPShieldTutorialConfig> = {
                                        tutorialStatus: "completed" as const,
                                        backends,
                                    }
                                    if (backends.length > 0) {
                                        extraConfig.backendAddress = backends[0].address
                                        extraConfig.backendPort = backends[0].port
                                    }
                                    await saveProgress(currentStep, extraConfig)
                                    await loadData()
                                }}
                                disabled={saving}
                                className="gap-1"
                            >
                                {saving ? (
                                    <Spinner className="h-4 w-4" />
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        Finish
                                    </>
                                )}
                            </Button>
                        ) : null}
                    </div>
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
                                It acts as a reverse proxy and filters malicious traffic before it reaches your server.
                                Setup is done through the TCPShield panel — no API key required.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </>
    )
}
