import { useState, useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
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
import { MoreVertical, Server, Plus, CheckCircle2, Upload, Pencil } from "lucide-react"
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
    // Analytics toggle
    const [enableAnalytics, setEnableAnalytics] = useState(true)
    // Import state
    const [showImportDialog, setShowImportDialog] = useState(false)
    const [importZipPath, setImportZipPath] = useState<string | null>(null)
    const [importName, setImportName] = useState("")
    const [isImporting, setIsImporting] = useState(false)
    const [importError, setImportError] = useState<string | null>(null)
    
    // Rename state
    const [renameTarget, setRenameTarget] = useState<ServerRecord | null>(null)
    const [renameValue, setRenameValue] = useState("")
    const [isRenaming, setIsRenaming] = useState(false)
    
    // Ref to track creation status without dependency cycle in useEffect
    const isCreatingRef = useRef(false)

    // Form state
    const [newServerName, setNewServerName] = useState("")
    const [version, setVersion] = useState("1.21.11")
    const [framework, setFramework] = useState("Paper")
    const [ramOption, setRamOption] = useState("4096")
    const [customRamMB, setCustomRamMB] = useState("")
    const [maxRamMB, setMaxRamMB] = useState(16384)

    const effectiveRamMB = ramOption === "custom"
        ? parseInt(customRamMB, 10) || 0
        : parseInt(ramOption, 10)

    const totalPages = Math.max(1, Math.ceil(servers.length / ITEMS_PER_PAGE))
    const paginatedServers = servers.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    )

    // Load system info for RAM limits
    useEffect(() => {
        window.context.getSystemInfo().then((info) => {
            setMaxRamMB(info.maxRamMB)
        })
    }, [])

    // Load servers on mount
    useEffect(() => {
        const refreshServers = () => {
            window.context.getServers().then(setServers)
        }
        const handleVisibilityChange = () => {
            if (!document.hidden) refreshServers()
        }

        refreshServers()
        window.addEventListener("focus", refreshServers)
        document.addEventListener("visibilitychange", handleVisibilityChange)

        return () => {
            window.removeEventListener("focus", refreshServers)
            document.removeEventListener("visibilitychange", handleVisibilityChange)
        }
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
            enableAnalytics: enableAnalytics && (framework === "Paper" || framework === "Purpur"),
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
    
    const handleSelectImportFile = async () => {
        const result = await window.context.openImportDialog()
        if (result.success && result.filePath) {
            setImportZipPath(result.filePath)
            // Extract default name from filename
            const fileName = result.filePath.split(/[/\\]/).pop() || "Imported Server"
            const defaultName = fileName.replace(/\.zip$/i, "")
            setImportName(defaultName)
            setShowImportDialog(true)
        }
    }
    
    const handleImportServer = async () => {
        if (!importZipPath || !importName.trim()) return
        
        setIsImporting(true)
        setImportError(null)
        
        const result = await window.context.importServer(importZipPath, importName.trim())
        
        if (result.success && result.server) {
            setServers((prev) => [...prev, result.server!])
            setShowImportDialog(false)
            setImportZipPath(null)
            setImportName("")
            setSuccessMessage(`Server "${result.server.name}" was imported successfully.`)
            setTimeout(() => setSuccessMessage(null), 4000)
        } else {
            setImportError(result.error || "Failed to import server")
        }
        
        setIsImporting(false)
    }
    
    const handleRenameServer = async () => {
        if (!renameTarget || !renameValue.trim()) return
        
        setIsRenaming(true)
        
        const result = await window.context.updateServerSettings(renameTarget.id, { name: renameValue.trim() })
        
        if (result.success) {
            setServers((prev) => prev.map((s) => s.id === renameTarget.id ? { ...s, name: renameValue.trim() } : s))
            setRenameTarget(null)
            setRenameValue("")
            setSuccessMessage(`Server renamed to "${renameValue.trim()}"`)
            setTimeout(() => setSuccessMessage(null), 4000)
        } else {
            // Could show error toast here
            console.error("Failed to rename server:", result.error)
        }
        
        setIsRenaming(false)
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
        <section className="flex flex-col gap-6 px-10 pb-10 pt-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
                        Server management
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold">Servers</h1>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={handleSelectImportFile}
                    >
                        <Upload className="h-4 w-4" />
                        Import
                    </Button>
                    <Button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                    >
                        <Plus className="h-4 w-4" />
                        New server
                    </Button>
                </div>
            </header>

            {successMessage && (
                <Alert className="border-primary/30 bg-primary/10">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <AlertTitle className="text-primary">Success</AlertTitle>
                    <AlertDescription className="text-muted-foreground">
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
                            <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
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
                                <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                    Version
                                </label>
                                <Select value={version} onValueChange={setVersion} disabled={isCreating}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60">
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
                                <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                    Platform
                                </label>
                                <Select value={framework} onValueChange={setFramework} disabled={isCreating}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Paper">Paper</SelectItem>
                                        <SelectItem value="Purpur">Purpur</SelectItem>
                                        <SelectItem value="Fabric">Fabric</SelectItem>
                                        <SelectItem value="Vanilla">Vanilla</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                RAM
                            </label>
                            <Select value={ramOption} onValueChange={setRamOption} disabled={isCreating}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[2048, 4096, 6144, 8192, 12288, 16384].filter(v => v <= maxRamMB).map(v => (
                                        <SelectItem key={v} value={String(v)}>{v >= 1024 ? `${v / 1024} GB` : `${v} MB`}</SelectItem>
                                    ))}
                                    <SelectItem value="custom">Custom</SelectItem>
                                </SelectContent>
                            </Select>
                            {ramOption === "custom" && (
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min={512}
                                        max={maxRamMB}
                                        value={customRamMB}
                                        onChange={(e) => setCustomRamMB(e.target.value)}
                                        placeholder="e.g. 7168"
                                        disabled={isCreating}
                                        className="w-[200px]"
                                    />
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">MB (max {maxRamMB})</span>
                                </div>
                            )}
                        </div>

                        {/* CatalystAnalytics toggle — shown for plugin-compatible platforms */}
                        {(framework === "Paper" || framework === "Purpur") && (
                            <div className="flex items-center justify-between rounded-lg border border-border p-3">
                                <div>
                                    <p className="text-sm font-medium">Enable CatalystAnalytics</p>
                                    <p className="text-xs text-muted-foreground">
                                        Auto-install the analytics plugin for server statistics
                                    </p>
                                </div>
                                <Switch
                                    checked={enableAnalytics}
                                    onCheckedChange={setEnableAnalytics}
                                    disabled={isCreating}
                                />
                            </div>
                        )}

                        {isCreating && creationProgress && (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-3">
                                    <Spinner className="text-primary" />
                                    <span className="text-sm text-muted-foreground">{creationProgress.message}</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                                    <div
                                        className="h-full bg-primary rounded-full transition-all duration-300"
                                        style={{ width: `${Math.min(creationProgress.percent, 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {creationError && (
                            <Alert variant="destructive">
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{creationError}</AlertDescription>
                            </Alert>
                        )}

                        <div className="flex gap-3">
                            <Button
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
                        <Button
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
                                className="flex items-center justify-between rounded-2xl border border-border bg-background/50 px-4 py-3 transition hover:border-muted-foreground/30 cursor-pointer"
                                onClick={() => navigate(`/servers/${server.id}`)}
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
                                            <DropdownMenuItem
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setRenameTarget(server)
                                                    setRenameValue(server.name)
                                                }}
                                            >
                                                <Pencil className="h-4 w-4 mr-2" />
                                                Rename
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                className="text-destructive"
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
                <AlertDialogContent className="border-border bg-popover">
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
                        <AlertDialogCancel className="border-border bg-transparent text-foreground hover:bg-muted">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

            {/* Import Server Dialog */}
            <AlertDialog
                open={showImportDialog}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowImportDialog(false)
                        setImportZipPath(null)
                        setImportName("")
                        setImportError(null)
                    }
                }}
            >
                <AlertDialogContent className="border-border bg-popover">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Import Server</AlertDialogTitle>
                        <AlertDialogDescription>
                            Enter a name for the imported server.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <Input
                            value={importName}
                            onChange={(e) =>
                                setImportName(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ""))
                            }
                            placeholder="My Imported Server"
                            disabled={isImporting}
                        />
                        {importError && (
                            <p className="mt-2 text-sm text-destructive">{importError}</p>
                        )}
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-border bg-transparent text-foreground hover:bg-muted">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isImporting || !importName.trim()}
                            onClick={handleImportServer}
                        >
                            {isImporting && <Spinner className="mr-2" />}
                            {isImporting ? "Importing..." : "Import"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Rename Server Dialog */}
            <AlertDialog
                open={renameTarget !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setRenameTarget(null)
                        setRenameValue("")
                    }
                }}
            >
                <AlertDialogContent className="border-border bg-popover">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Rename Server</AlertDialogTitle>
                        <AlertDialogDescription>
                            Enter a new name for "{renameTarget?.name}"
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <Input
                            value={renameValue}
                            onChange={(e) =>
                                setRenameValue(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ""))
                            }
                            placeholder="New server name"
                            disabled={isRenaming}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-border bg-transparent text-foreground hover:bg-muted">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isRenaming || !renameValue.trim()}
                            onClick={handleRenameServer}
                        >
                            {isRenaming && <Spinner className="mr-2" />}
                            {isRenaming ? "Renaming..." : "Rename"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    )
}
