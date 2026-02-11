import { useState, useEffect } from "react"
import { TitleBar } from "@/components/TitleBar"
import { AppSidebar } from "@/components/app-sidebar"
import { AnimatedOutlet } from "@/components/AnimatedOutlet"
import { Badge } from "@/components/ui/badge"
import { SidebarProvider } from "@/components/ui/sidebar"

export function DashboardLayout() {
    const [isMaximized, setIsMaximized] = useState(false)

    useEffect(() => {
        window.context?.getWindowState?.().then((state) => {
            setIsMaximized(state.isMaximized)
        })
        const unsubscribe = window.context?.onWindowStateChanged?.((state) => {
            setIsMaximized(state.isMaximized)
        })
        return () => {
            unsubscribe?.()
        }
    }, [])

    return (
        <div className="relative h-full min-h-screen w-full bg-background text-foreground" style={{ borderRadius: '12px', overflow: 'auto' }}>
            <TitleBar isMaximized={isMaximized} />
            <SidebarProvider>
                <div className="flex h-full w-full min-h-0">
                    <AppSidebar />
                    <main className="flex-1 min-h-0 overflow-auto pt-11">
                        <div className="flex min-h-0 flex-col">
                            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 px-8 py-4 backdrop-blur">
                                <div className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
                                    Workspace
                                </div>
                                <Badge variant="outline" className="border-border text-muted-foreground">
                                    Local runtime
                                </Badge>
                            </div>
                            <div className="flex-1 min-h-0">
                                <AnimatedOutlet />
                            </div>
                        </div>
                    </main>
                </div>
            </SidebarProvider>
        </div>
    )
}
