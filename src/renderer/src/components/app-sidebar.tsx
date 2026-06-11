import { NavLink, useLocation } from "react-router-dom"
import { motion } from "motion/react"
import { Activity, LayoutGrid, Server, Settings } from "@/components/icons"
import { useServerStore } from "@/stores/serverStore"

const navItems = [
    { label: "Dashboard", icon: LayoutGrid, path: "/" },
    { label: "Servers", icon: Server, path: "/servers" },
    { label: "Analytics", icon: Activity, path: "/analytics" },
    { label: "Settings", icon: Settings, path: "/settings" },
]

function CatalystMark() {
    return (
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-selected text-strong" aria-hidden="true">
            <svg viewBox="0 0 40 40" className="h-5 w-5" fill="none">
                <path d="M20 4 34 12v16L20 36 6 28V12L20 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M20 20 6.5 12.5M20 20l13.5-7.5M20 20v15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
        </div>
    )
}

export function AppSidebar() {
    const location = useLocation()
    const servers = useServerStore((state) => state.servers)
    const loaded = useServerStore((state) => state.loaded)
    const runningCount = servers.filter((server) => server.status === "Online").length

    const isItemActive = (path: string) =>
        path === "/" ? location.pathname === "/" : location.pathname.startsWith(path)

    return (
        <aside className="flex h-screen w-[232px] shrink-0 flex-col border-r border-border bg-background pt-3">
            <div
                className="flex h-12 items-center gap-3 px-5"
                style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
            >
                <CatalystMark />
                <div className="leading-none">
                    <div className="text-[16px] font-medium tracking-normal text-strong">Catalyst</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">Server Manager</div>
                </div>
            </div>

            <nav className="mt-5 flex flex-col gap-0.5 px-3">
                {navItems.map((item) => {
                    const active = isItemActive(item.path)
                    return (
                        <NavLink
                            key={item.label}
                            to={item.path}
                            className={`relative flex h-10 items-center gap-3 rounded-lg px-3.5 text-[13px] font-medium transition-colors duration-200 ${
                                active
                                    ? "text-strong"
                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            }`}
                        >
                            {active && (
                                <motion.span
                                    layoutId="sidebar-active"
                                    className="absolute inset-0 rounded-lg border border-border bg-selected"
                                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                                />
                            )}
                            <item.icon className="relative z-[1] h-4 w-4" />
                            <span className="relative z-[1]">{item.label}</span>
                        </NavLink>
                    )
                })}
            </nav>

            <div className="mt-auto px-3 pb-4">
                <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <span className={`status-dot ${runningCount > 0 ? "status-dot-online" : "status-dot-offline"}`} />
                    <div className="leading-none">
                        <div className="text-[12.5px] font-medium text-foreground">
                            {!loaded
                                ? "Syncing servers"
                                : runningCount > 0
                                ? `${runningCount} server${runningCount === 1 ? "" : "s"} running`
                                : "All servers stopped"}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                            {loaded ? `${servers.length} configured` : "Loading..."}
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    )
}
