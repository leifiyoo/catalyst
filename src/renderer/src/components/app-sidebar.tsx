import { NavLink, useLocation } from "react-router-dom"
import {
    MonitorDot,
    Server,
    Settings,
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
import sidebarLogo from "@/assets/transparentlogo.png"

const navItems = [
    { title: "Dashboard", icon: MonitorDot, path: "/" },
    { title: "Servers", icon: Server, path: "/servers" },
    { title: "Settings", icon: Settings, path: "/settings" },
]

export function AppSidebar() {
    const location = useLocation()

    return (
        <Sidebar className="border-r border-border bg-sidebar/95 backdrop-blur">
            <SidebarHeader className="px-5 pt-14 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <div
                        className="h-8 w-8"
                        style={{
                            WebkitMaskImage: `url(${sidebarLogo})`,
                            maskImage: `url(${sidebarLogo})`,
                            WebkitMaskSize: 'contain',
                            maskSize: 'contain',
                            WebkitMaskRepeat: 'no-repeat',
                            maskRepeat: 'no-repeat',
                            WebkitMaskPosition: 'center',
                            maskPosition: 'center',
                            backgroundColor: 'hsl(var(--primary))',
                        }}
                    />
                    <div>
                        <div className="text-lg font-semibold tracking-[0.08em]">
                            Catalyst
                        </div>
                        <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                            Server studio
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
                <div className="rounded-xl border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                    Workspace ready.
                </div>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
