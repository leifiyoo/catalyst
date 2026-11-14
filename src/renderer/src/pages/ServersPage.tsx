import { useState, useEffect, useRef, useCallback, type MutableRefObject } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
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
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { MoreVertical, Server, Plus, CheckCircle2, Upload, Pencil, FolderOpen, Trash2, ChevronRight } from "lucide-react"
import type { ServerRecord, ServerCreationProgress } from "@shared/types"
import { useServerStore } from "@/stores/serverStore"

const ITEMS_PER_PAGE = 20
const EASE = [0.22, 1, 0.36, 1] as const

const CALENDAR_MC_VERSIONS = ["26.2", "26.1.1", "26.1"]

// Paper, Purpur, and Vanilla publish the new calendar releases. Fabric stays on its supported legacy list.
const LEGACY_MC_VERSIONS = [
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
    "1.11.2", "1.10.2", "1.9.4", "1.8.8", "1.7.10",
]

const DEFAULT_MC_VERSION = LEGACY_MC_VERSIONS[0]
const STATUS_LABEL: Record<ServerRecord["status"], string> = {
    Starting: "Starting",
    Online: "Online",
    Stopping: "Stopping",
    Offline: "Offline",
    Idle: "Offline",
}

const STATUS_DOT: Record<ServerRecord["status"], string> = {
    Starting: "status-dot-starting",
    Online: "status-dot-online",
    Stopping: "status-dot-stopping",
    Offline: "status-dot-offline",
    Idle: "status-dot-idle",
}

const STATUS_TEXT: Record<ServerRecord["status"], string> = {
    Starting: "text-yellow-300",
    Online: "text-primary",
    Stopping: "text-orange-300",
    Offline: "text-muted-foreground",
    Idle: "text-muted-foreground",
}

function formatRam(ramMB: number) {
    if (ramMB >= 1024 && ramMB % 1024 === 0) return `${ramMB / 1024} GB`
    if (ramMB >= 1024) return `${(ramMB / 1024).toFixed(1)} GB`
    return `${ramMB} MB`
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <label className="text-[12.5px] font-medium text-muted-foreground">
            {children}
        </label>
    )
}

function useLazyRef<T>(factory: () => T): MutableRefObject<T> {
    const ref = useRef<T | null>(null)
    if (ref.current === null) {
        ref.current = factory()
    }
    return ref as MutableRefObject<T>
}

export function ServersPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { servers, loaded, refresh, removeServer } = useServerStore()
    const [currentPage, setCurrentPage] = useState(1)
    const [isCreating, setIsCreating] = useState(false)
    const [showCreateForm, setShowCreateForm] = useState(searchParams.get('create') === 'true')
    const [deleteTarget, setDeleteTarget] = useState<ServerRecord | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [creationProgress, setCreationProgress] = useState<ServerCreationProgress | null>(null)
    const [creationError, setCreationError] = useState<string | null>(null)
    const [enableAnalytics, setEnableAnalytics] = useState(true)

    // Import state
    const [showImportDialog, setShowImportDialog] = useState(false)
    const importZipPathRef = useRef<string | null>(null)
    const [importName, setImportName] = useState("")
    const [isImporting, setIsImporting] = useState(false)
    const [importError, setImportError] = useState<string | null>(null)

    // Rename state
    const [renameTarget, setRenameTarget] = useState<ServerRecord | null>(null)
    const [renameValue, setRenameValue] = useState("")
    const [isRenaming, setIsRenaming] = useState(false)

    const isCreatingRef = useRef(false)

    const timersRef = useLazyRef(() => new Set<ReturnType<typeof setTimeout>>())
    useEffect(() => {
        return () => {
            timersRef.current.forEach((t) => clearTimeout(t))
            timersRef.current.clear()
        }
    }, [])
    const safeTimeout = useCallback((fn: () => void, ms: number) => {
        const t = setTimeout(() => {
            timersRef.current.delete(t)
            fn()
        }, ms)
        timersRef.current.add(t)
        return t
    }, [])

    const flashSuccess = useCallback((message: string) => {
        setSuccessMessage(message)
        safeTimeout(() => setSuccessMessage(null), 4000)
    }, [safeTimeout])

    // Form state
    const [newServerName, setNewServerName] = useState("")
    const [version, setVersion] = useState(DEFAULT_MC_VERSION)
    const [framework, setFramework] = useState("Paper")
    const [ramOption, setRamOption] = useState("4096")
    const [customRamMB, setCustomRamMB] = useState("")
    const [maxRamMB, setMaxRamMB] = useState(16384)

    const availableVersions =
        framework === "Fabric" ? LEGACY_MC_VERSIONS : [...CALENDAR_MC_VERSIONS, ...LEGACY_MC_VERSIONS]
    const handleFrameworkChange = (nextFramework: string) => {
        setFramework(nextFramework)
        setVersion(nextFramework === "Fabric" ? DEFAULT_MC_VERSION : CALENDAR_MC_VERSIONS[0])
    }
    const effectiveRamMB = ramOption === "custom"
        ? parseInt(customRamMB, 10) || 0
        : parseInt(ramOption, 10)

    const totalPages = Math.max(1, Math.ceil(servers.length / ITEMS_PER_PAGE))
    const paginatedServers = servers.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    )

    useEffect(() => {
        window.context?.getSystemInfo?.().then((info) => {
            setMaxRamMB(info.maxRamMB)
        })
    }, [])

    useEffect(() => {
        const unsubscribe = window.context?.onServerCreationProgress?.((progress) => {
            if (isCreatingRef.current) {
                setCreationProgress(progress)
            }
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

        setIsCreating(false)
        isCreatingRef.current = false
        setCreationProgress(null)

        if (result.success && result.server) {
            await refresh()
            setNewServerName("")
            setVersion(DEFAULT_MC_VERSION)
            setFramework("Paper")
            setRamOption("4096")
            setCustomRamMB("")
            setShowCreateForm(false)
            flashSuccess(`Server "${result.server.name}" was created.`)
        } else {
            setCreationError(result.error || "Unknown error occurred")
        }
    }

    const handleDeleteServer = async (server: ServerRecord) => {
        const result = await window.context.deleteServer(server.id)
        if (result.success) {
            removeServer(server.id)
            await refresh()
        }
        setDeleteTarget(null)
    }

    const handleSelectImportFile = async () => {
        const result = await window.context.openImportDialog()
        if (result.success && result.filePath) {
            importZipPathRef.current = result.filePath
            const fileName = result.filePath.split(/[/\\]/).pop() || "Imported Server"
            setImportName(fileName.replace(/\.zip$/i, ""))
            setShowImportDialog(true)
        }
    }

    const handleImportServer = async () => {
        const importZipPath = importZipPathRef.current
        if (!importZipPath || !importName.trim()) return

        setIsImporting(true)
        setImportError(null)

        const result = await window.context.importServer(importZipPath, importName.trim())

        if (result.success && result.server) {
            await refresh()
            setShowImportDialog(false)
            importZipPathRef.current = null
            setImportName("")
            flashSuccess(`Server "${result.server.name}" was imported.`)
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
            await refresh()
            setRenameTarget(null)
            setRenameValue("")
            flashSuccess(`Server renamed to "${renameValue.trim()}"`)
        } else {
            console.error("Failed to rename server:", result.error)
        }

        setIsRenaming(false)
    }

    const renderPagination = () => {
        if (totalPages <= 1) return null
        const pages: number[] = []
        for (let i = 1; i <= totalPages; i++) pages.push(i)

        return (
            <Pagination className="mt-4 pb-2">
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
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
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        )
    }

    return (
        <motion.section
            initial={false}
            className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-8 pb-10 pt-7"
        >
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Servers</h1>
                    <p className="mt-1 text-[13.5px] text-muted-foreground">
                        {servers.length > 0
                            ? `${servers.length} server${servers.length === 1 ? "" : "s"} configured`
                            : "Create or import a Minecraft server"}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleSelectImportFile}>
                        <Upload className="h-4 w-4" />
                        Import
                    </Button>
                    <Button onClick={() => setShowCreateForm((v) => !v)}>
                        <Plus className="h-4 w-4" />
                        New server
                    </Button>
                </div>
            </header>

            <AnimatePresence>
                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                    >
                        <Alert className="border-primary/30 bg-primary/10">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                            <AlertDescription className="text-foreground">{successMessage}</AlertDescription>
                        </Alert>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
                {showCreateForm && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.35, ease: EASE }}
                        className="overflow-hidden"
                    >
                        <div className="rounded-2xl border border-border bg-card p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_14px_40px_rgba(0,0,0,0.08)]">
                            <h2 className="text-[15px] font-semibold text-foreground">Create a new server</h2>
                            <p className="mt-1 text-[13px] text-muted-foreground">
                                Pick a platform and version — Catalyst downloads and configures everything.
                            </p>

                            <div className="mt-6 grid gap-6 lg:grid-cols-[190px_1fr]">
                                <aside className="rounded-2xl border border-border bg-background/50 p-4">
                                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Setup guide</p>
                                    <div className="mt-4 space-y-4">
                                        {[["1", "Identity", "Name your workspace"], ["2", "Runtime", "Choose platform and version"], ["3", "Resources", "Set memory and analytics"]].map(([step, title, detail], index) => (
                                            <motion.div key={step} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.06 }} className="flex gap-2.5">
                                                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-primary/20 bg-primary/10 text-[10.5px] font-semibold text-primary">{step}</span>
                                                <div><p className="text-[12px] font-medium text-foreground">{title}</p><p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{detail}</p></div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </aside>
                                <div className="flex min-w-0 flex-col gap-4">
                                <div className="grid gap-2">
                                    <FieldLabel>Server name</FieldLabel>
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
                                        <FieldLabel>Version</FieldLabel>
                                        <Select value={version} onValueChange={setVersion} disabled={isCreating}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-60">
                                                {availableVersions.map((v) => (
                                                    <SelectItem key={v} value={v}>{v}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <FieldLabel>Platform</FieldLabel>
                                        <Select value={framework} onValueChange={handleFrameworkChange} disabled={isCreating}>
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
                                    <FieldLabel>RAM</FieldLabel>
                                    <Select value={ramOption} onValueChange={setRamOption} disabled={isCreating}>
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[2048, 4096, 6144, 8192, 12288, 16384].filter(v => v <= maxRamMB).map(v => (
                                                <SelectItem key={v} value={String(v)}>
                                                    {v >= 1024 ? `${v / 1024} GB` : `${v} MB`}
                                                </SelectItem>
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
                                            <span className="whitespace-nowrap text-xs text-muted-foreground">
                                                MB (max {maxRamMB})
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {(framework === "Paper" || framework === "Purpur") && (
                                    <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 p-3.5">
                                        <div>
                                            <p className="text-sm font-medium">Enable CatalystAnalytics</p>
                                            <p className="text-xs text-muted-foreground">
                                                Auto-install the analytics plugin for player and performance statistics
                                            </p>
                                        </div>
                                        <Switch
                                            checked={enableAnalytics}
                                            onCheckedChange={setEnableAnalytics}
                                            disabled={isCreating}
                                        />
                                    </div>
                                )}

                                <AnimatePresence>
                                    {isCreating && creationProgress && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="flex flex-col gap-2 overflow-hidden"
                                        >
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">{creationProgress.message}</span>
                                                <span className="font-data text-[12px] text-muted-foreground">
                                                    {Math.min(Math.round(creationProgress.percent), 100)}%
                                                </span>
                                            </div>
                                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                                <motion.div
                                                    className="h-full rounded-full bg-primary"
                                                    animate={{ width: `${Math.min(creationProgress.percent, 100)}%` }}
                                                    transition={{ duration: 0.3, ease: EASE }}
                                                />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {creationError && (
                                    <Alert variant="destructive">
                                        <AlertDescription>{creationError}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="flex gap-3">
                                    <Button
                                        onClick={handleCreateServer}
                                        disabled={isCreating || !newServerName.trim() || effectiveRamMB < 512}
                                    >
                                        {isCreating ? <Spinner className="mr-1" /> : <Plus className="h-4 w-4" />}
                                        {isCreating ? "Creating server..." : "Create server"}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={() => setShowCreateForm(false)}
                                        disabled={isCreating}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {loaded && servers.length === 0 && !showCreateForm ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-8 py-16 text-center">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-card text-muted-foreground">
                        <Server className="h-5 w-5" />
                    </div>
                    <h2 className="mt-4 text-base font-semibold">No servers yet</h2>
                    <p className="mt-1.5 max-w-xs text-[13.5px] text-muted-foreground">
                        Get started by creating your first Minecraft server, or import an existing one.
                    </p>
                    <Button className="mt-5" onClick={() => setShowCreateForm(true)}>
                        <Plus className="h-4 w-4" />
                        Create your first server
                    </Button>
                </div>
            ) : servers.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    {paginatedServers.map((server, index) => {
                        const online = server.status === "Online"
                        return (
                            <div
                                key={server.id}
                                onClick={() => navigate(`/servers/${server.id}`)}
                                className={`group flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors duration-200 hover:bg-muted/40 ${
                                    index > 0 ? "border-t border-border" : ""
                                }`}
                            >
                                <span className={`status-dot ${STATUS_DOT[server.status]}`} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13.5px] font-medium text-foreground">{server.name}</p>
                                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                                        {server.framework} {server.version} · {formatRam(server.ramMB)}
                                    </p>
                                </div>
                                <span
                                    className={`text-[12.5px] font-medium ${STATUS_TEXT[server.status]}`}
                                >
                                    {STATUS_LABEL[server.status]}
                                </span>
                                {online && server.players && (
                                    <span className="font-data hidden text-[12px] text-muted-foreground sm:block">
                                        {server.players}
                                    </span>
                                )}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground"
                                            onClick={(e) => e.stopPropagation()}
                                        >
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
                                            <ChevronRight className="mr-2 h-4 w-4" />
                                            Open panel
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                window.context.openServerFolder(server.id)
                                            }}
                                        >
                                            <FolderOpen className="mr-2 h-4 w-4" />
                                            Open folder
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setRenameTarget(server)
                                                setRenameValue(server.name)
                                            }}
                                        >
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setDeleteTarget(server)
                                            }}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )
                    })}
                    {renderPagination()}
                </div>
            ) : null}

            <AlertDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete server "{deleteTarget?.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. The server and all its data will be permanently deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteTarget && handleDeleteServer(deleteTarget)}
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
                        importZipPathRef.current = null
                        setImportName("")
                        setImportError(null)
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Import server</AlertDialogTitle>
                        <AlertDialogDescription>
                            Enter a name for the imported server.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-2">
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
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
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
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Rename server</AlertDialogTitle>
                        <AlertDialogDescription>
                            Enter a new name for "{renameTarget?.name}"
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-2">
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
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
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
        </motion.section>
    )
}
