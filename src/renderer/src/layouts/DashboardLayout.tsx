import { lazy, Suspense, useCallback, useEffect, useState } from "react"
import { Minus, Square, X, Copy } from "@/components/icons"
import { AppSidebar } from "@/components/app-sidebar"
import { AnimatedOutlet } from "@/components/AnimatedOutlet"
import { startServerSync } from "@/stores/serverStore"
import { Bot } from "lucide-react"

const dragRegion = { WebkitAppRegion: "drag" } as React.CSSProperties
const noDragRegion = { WebkitAppRegion: "no-drag" } as React.CSSProperties
const CommandPalette = lazy(() => import("@/components/CommandPalette").then((m) => ({ default: m.CommandPalette })))
const AiAssistantPanel = lazy(() => import("@/components/AiAssistantPanel").then((m) => ({ default: m.AiAssistantPanel })))
const AiAssistantOnboarding = lazy(() => import("@/components/AiAssistantOnboarding").then((m) => ({ default: m.AiAssistantOnboarding })))

export function DashboardLayout() {
    const [isMaximized, setIsMaximized] = useState(false)
    const [mountCommandPalette, setMountCommandPalette] = useState(false)
    const [assistantOpen, setAssistantOpen] = useState(false)

    useEffect(() => {
        startServerSync()

        window.context?.getWindowState?.().then((state) => {
            setIsMaximized(state.isMaximized)
        })

        return window.context?.onWindowStateChanged?.((state) => {
            setIsMaximized(state.isMaximized)
        })
    }, [])

    useEffect(() => {
        if (mountCommandPalette) return

        const openCommandPalette = (event?: KeyboardEvent) => {
            if (event && (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k")) return
            event?.preventDefault()
            setMountCommandPalette(true)
        }
        const openCommandPaletteFromEvent = () => openCommandPalette()

        window.addEventListener("keydown", openCommandPalette)
        window.addEventListener("catalyst:command-palette", openCommandPaletteFromEvent)
        return () => {
            window.removeEventListener("keydown", openCommandPalette)
            window.removeEventListener("catalyst:command-palette", openCommandPaletteFromEvent)
        }
    }, [mountCommandPalette])

    useEffect(() => {
        const openAssistant = () => setAssistantOpen(true)
        window.addEventListener("catalyst:ai-assistant", openAssistant)
        return () => window.removeEventListener("catalyst:ai-assistant", openAssistant)
    }, [])

    const handleControl = useCallback((action: "minimize" | "toggle-maximize" | "close") => {
        window.context?.windowControl?.(action)
    }, [])

    return (
        <div className="relative flex h-screen overflow-hidden bg-background text-foreground">
            <AppSidebar />

            <div className="flex h-screen min-w-0 flex-1 flex-col">
                <header
                    className="flex h-[60px] shrink-0 items-center justify-end border-b border-border pl-8 pr-4 pt-2"
                    style={dragRegion}
                >
                    <div className="flex items-center gap-1" style={noDragRegion}>
                        <button
                            type="button"
                            className={`mr-2 inline-flex h-8 items-center gap-2 rounded-full border border-border px-3 text-[12.5px] font-medium transition-colors duration-150 hover:bg-muted hover:text-foreground ${
                                assistantOpen ? "bg-muted text-foreground" : "bg-card text-muted-foreground"
                            }`}
                            aria-label={assistantOpen ? "Close AI Assistant" : "Open AI Assistant"}
                            title={assistantOpen ? "Close AI Assistant" : "Open AI Assistant"}
                            onClick={() => setAssistantOpen((value) => !value)}
                        >
                            <Bot className="h-4 w-4" />
                            AI
                        </button>
                        <button
                            type="button"
                            className="grid h-8 w-9 place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                            aria-label="Minimize"
                            onClick={() => handleControl("minimize")}
                        >
                            <Minus className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            className="grid h-8 w-9 place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                            aria-label={isMaximized ? "Restore" : "Maximize"}
                            onClick={() => handleControl("toggle-maximize")}
                        >
                            {isMaximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                        </button>
                        <button
                            type="button"
                            className="grid h-8 w-9 place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-destructive hover:text-destructive-foreground"
                            aria-label="Close"
                            onClick={() => handleControl("close")}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </header>

                <main className="app-main-scroll relative min-h-0 flex-1 overflow-y-scroll">
                    <AnimatedOutlet />
                </main>
            </div>

            {mountCommandPalette && (
                <Suspense fallback={null}>
                    <CommandPalette initialOpen />
                </Suspense>
            )}

            <Suspense fallback={null}>
                <AiAssistantPanel open={assistantOpen} onOpenChange={setAssistantOpen} />
                <AiAssistantOnboarding onOpenAssistant={() => setAssistantOpen(true)} />
            </Suspense>
        </div>
    )
}
