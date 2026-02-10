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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
    const [deleteTarget, setDeleteTarget] = useState<ServerRecord | null>(null)

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

    const handleDeleteServer = async (server: ServerRecord) => {
        const result = await window.context.deleteServer(server.id)
        if (result.success) {
            setServers((prev) => prev.filter((s) => s.id !== server.id))
        }
        setDeleteTarget(null)
    }

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
        <section className="flex flex-col gap-8 px-10 pb-10 pt-6">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
                        Overview
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold">
                        Command center
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Manage your Minecraft servers and keep tabs on live activity.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => navigate("/servers?create=true")}
                        className="min-w-[140px]">
                        <Plus className="h-4 w-4" />
                        New server
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/servers")}
                        className="min-w-[140px]">
                        View all
                    </Button>
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="flex flex-col gap-6">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardDescription>Total servers</CardDescription>
                                <CardTitle className="text-2xl">
                                    {servers.length}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground">
                                {servers.filter((s) => s.status === "Online").length}{" "}
                                online now
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardDescription>Players online</CardDescription>
                                <CardTitle className="text-2xl">0</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground">
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
                            <CardContent className="text-sm text-muted-foreground">
                                {lastCreated
                                    ? new Date(lastCreated.createdAt).toLocaleDateString()
                                    : "No servers yet"}
                            </CardContent>
                        </Card>
                    </div>

                    {servers.length === 0 ? (
                        <Empty className="border-border">
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
                                <Button onClick={() => navigate("/servers")}
                                    className="min-w-[200px]">
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
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                {servers.map((server) => (
                                    <div
                                        key={server.id}
                                        className="flex items-center justify-between rounded-2xl border border-border bg-background/50 px-4 py-3 text-left transition hover:border-muted-foreground/30 cursor-pointer"
                                        onClick={() =>
                                            navigate(`/servers/${server.id}`)
                                        }
                                    >
                                        <div>
                                            <p className="text-sm font-semibold">
                                                {server.name}
                                            </p>
                                            <span className="text-xs text-muted-foreground">
                                                {server.framework} &bull;{" "}
                                                {server.version} &bull;{" "}
                                                {formatRam(server.ramMB)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs">
                                            <Badge
                                                className={
                                                    server.status === "Online"
                                                        ? "bg-primary/15 text-primary"
                                                        : server.status === "Idle"
                                                          ? "bg-muted text-muted-foreground"
                                                          : "bg-destructive/15 text-destructive"
                                                }
                                            >
                                                {server.status}
                                            </Badge>
                                            <span className="text-muted-foreground">{server.players}</span>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
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
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setDeleteTarget(server)
                                                        }}
                                                    >
                                                        Delete server
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>

                <aside className="flex flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Quick actions</CardTitle>
                            <CardDescription>Shortcuts for common tasks</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2">
                            <Button variant="outline" onClick={() => navigate("/servers?create=true")}>
                                <Plus className="h-4 w-4" />
                                Create server
                            </Button>
                            <Button variant="outline" onClick={() => navigate("/servers")}>
                                <Server className="h-4 w-4" />
                                View all servers
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Latest activity</CardTitle>
                            <CardDescription>Most recent server change</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            {lastCreated ? (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Server</span>
                                        <span className="font-medium">{lastCreated.name}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Created</span>
                                        <span>
                                            {new Date(lastCreated.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Status</span>
                                        <Badge className="bg-muted text-muted-foreground">
                                            {lastCreated.status}
                                        </Badge>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-muted-foreground">No activity yet.</p>
                            )}
                        </CardContent>
                    </Card>
                </aside>
            </div>

            <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Server</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{deleteTarget?.name}"? This will permanently remove the server and all its files. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600"
                            onClick={() => deleteTarget && handleDeleteServer(deleteTarget)}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    )
}
