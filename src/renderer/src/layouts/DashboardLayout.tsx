import { useCallback, useEffect, useState } from "react"
import { Minus, Square, X, Copy } from "@/components/icons"
import { AppSidebar } from "@/components/app-sidebar"
import { AnimatedOutlet } from "@/components/AnimatedOutlet"
import { CommandPalette } from "@/components/CommandPalette"
import { startServerSync } from "@/stores/serverStore"

const dragRegion = { WebkitAppRegion: "drag" } as React.CSSProperties
const noDragRegion = { WebkitAppRegion: "no-drag" } as React.CSSProperties

export function DashboardLayout() {
    const [isMaximized, setIsMaximized] = useState(false)

    useEffect(() => {
        startServerSync()

        window.context?.getWindowState?.().then((state) => {
            setIsMaximized(state.isMaximized)
        })

        return window.context?.onWindowStateChanged?.((state) => {
            setIsMaximized(state.isMaximized)
        })
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

            <CommandPalette />
        </div>
    )
}
