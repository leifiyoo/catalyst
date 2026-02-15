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
    ExternalLink,
    RotateCcw,
    Shield,
    ShieldCheck,
} from "lucide-react"
import type { TCPShieldTutorialConfig, TCPShieldTutorialStep } from "@shared/types"

export function TCPShieldTutorial() {
    const [loading, setLoading] = useState(true)
    const [config, setConfig] = useState<TCPShieldTutorialConfig | null>(null)
    const [steps, setSteps] = useState<TCPShieldTutorialStep[]>([])
    const [currentStep, setCurrentStep] = useState(0)
    const [inputValues, setInputValues] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState(false)

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
            setInputValues({
                protectedCname: tutorialConfig.protectedCname || "",
                backendAddress: tutorialConfig.backendAddress || "",
                backendPort: String(tutorialConfig.backendPort || 25565),
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

    const handleNext = async () => {
        if (currentStep >= steps.length - 1) return

        const step = steps[currentStep]
        const extraConfig: Partial<TCPShieldTutorialConfig> = {}

        // Save input values for steps that have inputs
        if (step?.inputField === "protectedCname") {
            extraConfig.protectedCname = inputValues.protectedCname || ""
        }
        if (step?.inputField === "backendAddress") {
            extraConfig.backendAddress = inputValues.backendAddress || ""
            extraConfig.backendPort = parseInt(inputValues.backendPort || "25565", 10) || 25565
        }

        const nextStep = currentStep + 1
        setCurrentStep(nextStep)
        await saveProgress(nextStep, extraConfig)
    }

    const handlePrevious = () => {
        if (currentStep <= 0) return
        const prevStep = currentStep - 1
        setCurrentStep(prevStep)
        saveProgress(prevStep)
    }

    const handleReset = async () => {
        await window.context.tcpshieldResetTutorial()
        setCurrentStep(0)
        setInputValues({
            protectedCname: "",
            backendAddress: "",
            backendPort: "25565",
        })
        await loadData()
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
                            TCPShield Einrichtung
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Badge variant={isCompleted ? "default" : "secondary"}>
                                {isCompleted
                                    ? "Abgeschlossen"
                                    : `Schritt ${currentStep + 1} von ${totalSteps}`}
                            </Badge>
                            {(config?.tutorialStatus === "in-progress" || isCompleted) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleReset}
                                    title="Tutorial zurücksetzen"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                    <CardDescription>
                        Schritt-für-Schritt Anleitung zur Einrichtung von TCPShield DDoS-Schutz
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
                                                  : instruction.startsWith("Kein eigener") || instruction.startsWith("Tipp:")
                                                    ? "text-primary italic"
                                                    : "text-foreground"
                                        }`}
                                    >
                                        {instruction !== "" && (
                                            <>
                                                {!instruction.startsWith("  →") &&
                                                    !instruction.startsWith("Kein eigener") &&
                                                    !instruction.startsWith("Tipp:") &&
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

                            {/* Input Field */}
                            {step.hasInput && step.inputField === "protectedCname" && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">
                                        {step.inputLabel}
                                    </label>
                                    <Input
                                        placeholder={step.inputPlaceholder}
                                        value={inputValues.protectedCname || ""}
                                        onChange={(e) =>
                                            setInputValues((prev) => ({
                                                ...prev,
                                                protectedCname: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            )}

                            {step.hasInput && step.inputField === "backendAddress" && (
                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">
                                            Server-IP
                                        </label>
                                        <Input
                                            placeholder={step.inputPlaceholder}
                                            value={inputValues.backendAddress || ""}
                                            onChange={(e) =>
                                                setInputValues((prev) => ({
                                                    ...prev,
                                                    backendAddress: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">
                                            Port
                                        </label>
                                        <Input
                                            type="number"
                                            placeholder="25565"
                                            value={inputValues.backendPort || "25565"}
                                            onChange={(e) =>
                                                setInputValues((prev) => ({
                                                    ...prev,
                                                    backendPort: e.target.value,
                                                }))
                                            }
                                        />
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
                                    {step.externalLinkLabel || "Link öffnen"}
                                </Button>
                            )}

                            {/* Completion Summary */}
                            {isCompleted && currentStep === totalSteps - 1 && (
                                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        <p className="font-medium text-green-500">
                                            Einrichtung abgeschlossen!
                                        </p>
                                    </div>
                                    {config?.protectedCname && (
                                        <p className="text-sm text-muted-foreground">
                                            Spieler verbinden sich über:{" "}
                                            <code className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                                                {config.protectedCname}
                                            </code>
                                        </p>
                                    )}
                                    {config?.backendAddress && (
                                        <p className="text-sm text-muted-foreground">
                                            Backend:{" "}
                                            <code className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                                                {config.backendAddress}:{config.backendPort || 25565}
                                            </code>
                                        </p>
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
                            Zurück
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
                                        Weiter
                                        <ChevronRight className="h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        ) : !isCompleted ? (
                            <Button
                                onClick={async () => {
                                    await saveProgress(currentStep, {
                                        tutorialStatus: "completed" as const,
                                    })
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
                                        Abschließen
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
                            <p className="font-medium text-foreground/80">Über TCPShield</p>
                            <p className="text-sm text-muted-foreground">
                                TCPShield bietet DDoS-Schutz für Minecraft-Server auf Enterprise-Niveau.
                                Es fungiert als Reverse-Proxy und filtert schädlichen Traffic, bevor er deinen Server erreicht.
                                Die Einrichtung erfolgt über das TCPShield Panel — es wird kein API-Key benötigt.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </>
    )
}
