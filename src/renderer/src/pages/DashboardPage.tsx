import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty"
import { MoreVertical, Server, Plus } from "lucide-react"
import type { ServerRecord } from "@shared/types"

export function DashboardPage() {
    const navigate = useNavigate()
    const [servers, setServers] = useState<ServerRecord[]>([])

    useEffect(() => {
        window.context.getServers().then(setServers)
    }, [])

    // Subscribe to real-time server status updates
    useEffect(() => {
        const unsubscribe = window.context.onServerStatus((update) => {
            setServers((prev) =>
                prev.map((s) =>
                    s.id === update.serverId
                        ? { ...s, status: update.status, players: update.players || s.players }
                        : s
                )
            )
        })
        return unsubscribe
    }, [])

    const formatRam = (ramMB: number) => {
        if (ramMB >= 1024 && ramMB % 1024 === 0) {
            return `${ramMB / 1024} GB`
        }
        if (ramMB >= 1024) {
            return `${(ramMB / 1024).toFixed(1)} GB`
        }
        return `${ramMB} MB`
    }

    const lastCreated = servers.length > 0
        ? servers.reduce((a, b) => a.createdAt > b.createdAt ? a : b)
        : null

    return (
        <section className="flex flex-col gap-6 px-10 pb-10 pt-4">
            <header className="flex items-end justify-between gap-6">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/70">
                        Minecraft hosting
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold">
                        Server command center
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        className="bg-cyan-400 text-black hover:bg-cyan-300"
                        onClick={() => navigate("/servers?create=true")}
                    >
                        <Plus className="h-4 w-4" />
                        New server
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <CardHeader>
                        <CardDescription>Total servers</CardDescription>
                        <CardTitle className="text-2xl">
                            {servers.length}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-white/70">
                        {servers.filter((s) => s.status === "Online").length}{" "}
                        online now
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardDescription>Players online</CardDescription>
                        <CardTitle className="text-2xl">0</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-white/70">
                        Active on live servers
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardDescription>Last created</CardDescription>
                        <CardTitle className="text-2xl">
                            {lastCreated ? lastCreated.name : "-"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-white/70">
                        {lastCreated
                            ? new Date(lastCreated.createdAt).toLocaleDateString()
                            : "No servers yet"}
                    </CardContent>
                </Card>
            </div>

            {servers.length === 0 ? (
                <Empty className="border-white/10">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Server />
                        </EmptyMedia>
                        <EmptyTitle>No Servers Yet</EmptyTitle>
                        <EmptyDescription>
                            You haven't created any servers yet. Get started by
                            creating your first Minecraft server.
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button
                            className="bg-cyan-400 text-black hover:bg-cyan-300"
                            onClick={() => navigate("/servers")}
                        >
                            <Plus className="h-4 w-4" />
                            Create your first server
                        </Button>
                    </EmptyContent>
                </Empty>
            ) : (
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <div>
                            <CardTitle>Servers</CardTitle>
                            <CardDescription>
                                Click a server to open its panel
                            </CardDescription>
                        </div>
                        <Button
                            variant="ghost"
                            className="text-cyan-200"
                            onClick={() => navigate("/servers")}
                        >
                            View all
                        </Button>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {servers.map((server) => (
                            <button
                                key={server.id}
                                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-white/20"
                                onClick={() =>
                                    navigate(`/servers/${server.id}`)
                                }
                            >
                                <div>
                                    <p className="text-sm font-semibold">
                                        {server.name}
                                    </p>
                                    <span className="text-xs text-white/70">
                                        {server.framework} &bull;{" "}
                                        {server.version} &bull;{" "}
                                        {formatRam(server.ramMB)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                    <Badge
                                        className={
                                            server.status === "Online"
                                                ? "bg-cyan-400/20 text-cyan-200"
                                                : server.status === "Idle"
                                                  ? "bg-white/10 text-white/70"
                                                  : "bg-red-400/20 text-red-200"
                                        }
                                    >
                                        {server.status}
                                    </Badge>
                                    <span>{server.players}</span>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    navigate(`/servers/${server.id}`)
                                                }}
                                            >
                                                Open panel
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    window.context.openServerFolder(server.id)
                                                }}
                                            >
                                                Open folder
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </button>
                        ))}
                    </CardContent>
                </Card>
            )}
        </section>
    )
}
