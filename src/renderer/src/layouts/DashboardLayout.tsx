import { useState, useEffect } from "react"
import { TitleBar } from "@/components/TitleBar"
import { AppSidebar } from "@/components/app-sidebar"
import { AnimatedOutlet } from "@/components/AnimatedOutlet"
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
        <div className="relative h-screen w-full bg-background text-foreground dark" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.03),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(255,255,255,0.03),transparent_50%)]" />
            <TitleBar isMaximized={isMaximized} />
            <SidebarProvider>
                <div className="flex h-full w-full">
                    <AppSidebar />
                    <main className="flex-1 overflow-auto pt-12">
                        <AnimatedOutlet />
                    </main>
                </div>
            </SidebarProvider>
        </div>
    )
}
