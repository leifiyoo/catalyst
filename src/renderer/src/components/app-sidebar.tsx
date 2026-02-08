import { NavLink, useLocation } from "react-router-dom"
import {
    MonitorDot,
    Server,
} from "lucide-react"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarRail,
} from "@/components/ui/sidebar"

const navItems = [
    { title: "Dashboard", icon: MonitorDot, path: "/" },
    { title: "Servers", icon: Server, path: "/servers" },
]

export function AppSidebar() {
    const location = useLocation()

    return (
        <Sidebar className="border-r border-border bg-sidebar backdrop-blur">
            <SidebarHeader className="px-5 pt-14 pb-4 border-b border-border">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-lg font-semibold uppercase tracking-[0.2em] text-cyan-300">
                            Catalyst
                        </div>
                        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                            Local studio
                        </p>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent className="justify-center">
                <SidebarGroup>
                    <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => {
                                const isActive =
                                    item.path === "/"
                                        ? location.pathname === "/"
                                        : location.pathname.startsWith(item.path)
                                return (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isActive}
                                            tooltip={item.title}
                                        >
                                            <NavLink to={item.path}>
                                                <item.icon className="h-4 w-4" />
                                                <span>{item.title}</span>
                                            </NavLink>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="px-4 pb-5">
                <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/5 px-3 py-2 text-xs text-cyan-300/60">
                    Ready for new worlds.
                </div>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
