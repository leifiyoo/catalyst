import { useState, useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
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
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { MoreVertical, Server, Plus, CheckCircle2 } from "lucide-react"
import type { ServerRecord, ServerCreationProgress } from "@shared/types"

const ITEMS_PER_PAGE = 20

export function ServersPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [servers, setServers] = useState<ServerRecord[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [isCreating, setIsCreating] = useState(false)
    const [showCreateForm, setShowCreateForm] = useState(searchParams.get('create') === 'true')
    const [deleteTarget, setDeleteTarget] = useState<ServerRecord | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [creationProgress, setCreationProgress] = useState<ServerCreationProgress | null>(null)
    const [creationError, setCreationError] = useState<string | null>(null)
    
    // Ref to track creation status without dependency cycle in useEffect
    const isCreatingRef = useRef(false)

    // Form state
    const [newServerName, setNewServerName] = useState("")
    const [version, setVersion] = useState("1.21.11")
    const [framework, setFramework] = useState("Paper")
    const [ramOption, setRamOption] = useState("4096")
    const [customRamMB, setCustomRamMB] = useState("")

    const effectiveRamMB = ramOption === "custom"
        ? parseInt(customRamMB, 10) || 0
        : parseInt(ramOption, 10)

    const totalPages = Math.max(1, Math.ceil(servers.length / ITEMS_PER_PAGE))
    const paginatedServers = servers.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    )

    // Load servers on mount
    useEffect(() => {
        window.context.getServers().then(setServers)
    }, [])

    // Subscribe to creation progress
    useEffect(() => {
        const unsubscribe = window.context.onServerCreationProgress((progress) => {
            if (isCreatingRef.current) {
                setCreationProgress(progress)
            }
        })
        return unsubscribe
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

    const handleCreateServer = async () => {
        if (!newServerName.trim()) return
        if (effectiveRamMB < 512) return

        setIsCreating(true)
        isCreatingRef.current = true
        setCreationProgress(null)
        setCreationError(null)

        const result = await window.context.createServer({
            name: newServerName.trim(),
            framework,
            version,
            ramMB: effectiveRamMB,
        })

        if (result.success && result.server) {
            setServers((prev) => [...prev, result.server!])
            setNewServerName("")
            setRamOption("4096")
            setCustomRamMB("")
            setIsCreating(false)
            isCreatingRef.current = false
            setShowCreateForm(false)
            setCreationProgress(null)
            setSuccessMessage(`Server "${result.server.name}" was created.`)
            setTimeout(() => setSuccessMessage(null), 4000)
        } else {
            setCreationError(result.error || "Unknown error occurred")
            setIsCreating(false)
            isCreatingRef.current = false
            setCreationProgress(null)
        }
    }

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

    const renderPagination = () => {
        if (totalPages <= 1) return null
        const pages: number[] = []
        for (let i = 1; i <= totalPages; i++) pages.push(i)

        return (
            <Pagination className="mt-6">
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            onClick={() =>
                                setCurrentPage((p) => Math.max(1, p - 1))
                            }
                            className={
                                currentPage === 1
                                    ? "pointer-events-none opacity-50"
                                    : "cursor-pointer"
                            }
                        />
                    </PaginationItem>
                    {pages.map((page) => {
                        if (
                            totalPages > 7 &&
                            page !== 1 &&
                            page !== totalPages &&
                            Math.abs(page - currentPage) > 1
                        ) {
                            if (page === 2 || page === totalPages - 1) {
                                return (
                                    <PaginationItem key={page}>
                                        <PaginationEllipsis />
                                    </PaginationItem>
                                )
                            }
                            return null
                        }
                        return (
                            <PaginationItem key={page}>
                                <PaginationLink
                                    isActive={currentPage === page}
                                    onClick={() => setCurrentPage(page)}
                                    className="cursor-pointer"
                                >
                                    {page}
                                </PaginationLink>
                            </PaginationItem>
                        )
                    })}
                    <PaginationItem>
                        <PaginationNext
                            onClick={() =>
                                setCurrentPage((p) =>
                                    Math.min(totalPages, p + 1)
                                )
                            }
                            className={
                                currentPage === totalPages
                                    ? "pointer-events-none opacity-50"
                                    : "cursor-pointer"
                            }
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        )
    }

    return (
        <section className="flex flex-col gap-6 px-10 pb-10 pt-4">
            <header className="flex items-end justify-between gap-6">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/70">
                        Server management
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold">Servers</h1>
                </div>
                <Button
                    className="bg-cyan-400 text-black hover:bg-cyan-300"
                    onClick={() => setShowCreateForm(!showCreateForm)}
                >
                    <Plus className="h-4 w-4" />
                    New server
                </Button>
            </header>

            {successMessage && (
                <Alert className="border-cyan-400/30 bg-cyan-400/10">
                    <CheckCircle2 className="h-4 w-4 text-cyan-300" />
                    <AlertTitle className="text-cyan-200">
                        Success
                    </AlertTitle>
                    <AlertDescription className="text-cyan-200/70">
                        {successMessage}
                    </AlertDescription>
                </Alert>
            )}

            {showCreateForm && (
                <Card>
                    <CardHeader>
                        <CardTitle>Create a new server</CardTitle>
                        <CardDescription>
                            Configure your Minecraft server
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <div className="grid gap-2">
                            <label className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">
                                Server name
                            </label>
                            <Input
                                value={newServerName}
                                onChange={(e) =>
                                    setNewServerName(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ""))
                                }
                                placeholder="My Minecraft Server"
                                disabled={isCreating}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-2">
                                <label className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">
                                    Version
                                </label>
                                <Select value={version} onValueChange={setVersion} disabled={isCreating}>
                                    <SelectTrigger className="border-white/10 bg-white/5">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60 border-white/10 bg-[#121218]">
                                        {[
                                            "1.21.11", "1.21.10", "1.21.9", "1.21.8", "1.21.7",
                                            "1.21.6", "1.21.5", "1.21.4", "1.21.3", "1.21.1", "1.21",
                                            "1.20.6", "1.20.5", "1.20.4", "1.20.2", "1.20.1", "1.20",
                                            "1.19.4", "1.19.3", "1.19.2", "1.19.1", "1.19",
                                            "1.18.2", "1.18.1", "1.18",
                                            "1.17.1", "1.17",
                                            "1.16.5", "1.16.4", "1.16.3", "1.16.2", "1.16.1",
                                            "1.15.2", "1.15.1", "1.15",
                                            "1.14.4", "1.14.3", "1.14.2", "1.14.1", "1.14",
                                            "1.13.2", "1.13.1", "1.13",
                                            "1.12.2", "1.12.1", "1.12",
                                            "1.11.2",
                                            "1.10.2",
                                            "1.9.4",
                                            "1.8.8",
                                            "1.7.10",
                                        ].map((v) => (
                                            <SelectItem key={v} value={v}>{v}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <label className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">
                                    Platform
                                </label>
                                <Select value={framework} onValueChange={setFramework} disabled={isCreating}>
                                    <SelectTrigger className="border-white/10 bg-white/5">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-[#121218]">
                                        <SelectItem value="Paper">Paper</SelectItem>
                                        <SelectItem value="Purpur">Purpur</SelectItem>
                                        <SelectItem value="Fabric">Fabric</SelectItem>
                                        <SelectItem value="Vanilla">Vanilla</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <label className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">
                                RAM
                            </label>
                            <Select value={ramOption} onValueChange={setRamOption} disabled={isCreating}>
                                <SelectTrigger className="w-[200px] border-white/10 bg-white/5">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-white/10 bg-[#121218]">
                                    <SelectItem value="2048">2 GB</SelectItem>
                                    <SelectItem value="4096">4 GB</SelectItem>
                                    <SelectItem value="6144">6 GB</SelectItem>
                                    <SelectItem value="8192">8 GB</SelectItem>
                                    <SelectItem value="12288">12 GB</SelectItem>
                                    <SelectItem value="16384">16 GB</SelectItem>
                                    <SelectItem value="custom">Custom</SelectItem>
                                </SelectContent>
                            </Select>
                            {ramOption === "custom" && (
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min={512}
                                        max={32768}
                                        value={customRamMB}
                                        onChange={(e) => setCustomRamMB(e.target.value)}
                                        placeholder="e.g. 7168"
                                        disabled={isCreating}
                                        className="w-[200px]"
                                    />
                                    <span className="text-xs text-white/70 whitespace-nowrap">MB</span>
                                </div>
                            )}
                        </div>

                        {isCreating && creationProgress && (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-3">
                                    <Spinner className="text-cyan-300" />
                                    <span className="text-sm text-white/70">{creationProgress.message}</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                                    <div
                                        className="h-full bg-cyan-400 rounded-full transition-all duration-300"
                                        style={{ width: `${Math.min(creationProgress.percent, 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {creationError && (
                            <Alert className="border-red-400/30 bg-red-400/10">
                                <AlertTitle className="text-red-200">Error</AlertTitle>
                                <AlertDescription className="text-red-200/70">
                                    {creationError}
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="flex gap-3">
                            <Button
                                className="bg-cyan-400 text-black hover:bg-cyan-300"
                                onClick={handleCreateServer}
                                disabled={
                                    isCreating ||
                                    !newServerName.trim() ||
                                    effectiveRamMB < 512
                                }
                            >
                                {isCreating && <Spinner className="mr-2" />}
                                {isCreating
                                    ? "Creating server..."
                                    : "Create server"}
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => setShowCreateForm(false)}
                                disabled={isCreating}
                            >
                                Cancel
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {servers.length === 0 && !showCreateForm ? (
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
                            onClick={() => setShowCreateForm(true)}
                        >
                            <Plus className="h-4 w-4" />
                            Create your first server
                        </Button>
                    </EmptyContent>
                </Empty>
            ) : servers.length > 0 ? (
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <div>
                            <CardTitle>All Servers</CardTitle>
                            <CardDescription>
                                {servers.length} server
                                {servers.length !== 1 ? "s" : ""} total
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {paginatedServers.map((server) => (
                            <div
                                key={server.id}
                                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-white/20 cursor-pointer"
                                onClick={() => navigate(`/servers/${server.id}`)}
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
                                            <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
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
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                className="text-red-300"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setDeleteTarget(server)
                                                }}
                                            >
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        ))}
                        {renderPagination()}
                    </CardContent>
                </Card>
            ) : null}

            <AlertDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null)
                }}
            >
                <AlertDialogContent className="border-white/10 bg-[#121218]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete server "{deleteTarget?.name}"?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. The server and all its
                            data will be permanently deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-500 text-white hover:bg-red-600"
                            onClick={() =>
                                deleteTarget &&
                                handleDeleteServer(deleteTarget)
                            }
                        >
                            Delete server
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    )
}
