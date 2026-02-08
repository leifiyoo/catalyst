import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
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
import { Spinner } from "@/components/ui/spinner"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    ArrowLeft,
    Play,
    Square,
    FolderOpen,
    Send,
    Save,
    Plus,
    X,
    Info,
    CheckCircle2,
    Users,
    Gauge,
    MemoryStick,
    File,
    Folder,
    ChevronRight,
    ChevronLeft,
    FileText,
    RefreshCw,
    Trash2,
    Download,
    ExternalLink,
    Search,
    Globe,
    Heart,
    Clock,
    Calendar,
    Box,
    ScrollText,
    Anvil,
    Layers,
    Leaf,
    Droplet,
    Wind,
    Zap,
} from "lucide-react"
import type {
    ServerRecord,
    ConsoleLine,
    ServerProperty,
    ServerStats,
    FileEntry,
    ModrinthSearchHit,
    ModrinthInstallEntry,
    ModrinthProjectType,
    ModrinthProjectDetails,
} from "@shared/types"

export function ServerDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [server, setServer] = useState<ServerRecord | null>(null)
    const [loading, setLoading] = useState(true)
    
    // File Context Menu & Actions
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null)
    const [fileRenameDialogOpen, setFileRenameDialogOpen] = useState(false)
    const [fileDuplicateDialogOpen, setFileDuplicateDialogOpen] = useState(false)
    const [fileDeleteDialogOpen, setFileDeleteDialogOpen] = useState(false)
    const [fileActionInput, setFileActionInput] = useState("")
    const [targetEntry, setTargetEntry] = useState<FileEntry | null>(null)

    // Close context menu on click elsewhere
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener("click", handleClick);
        return () => window.removeEventListener("click", handleClick);
    }, []);

    // Console state
    const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([])
    const [commandInput, setCommandInput] = useState("")
    const consoleEndRef = useRef<HTMLDivElement>(null)

    // Properties state
    const [properties, setProperties] = useState<ServerProperty[]>([])
    const [propsLoaded, setPropsLoaded] = useState(false)
    const [propsSaving, setPropsSaving] = useState(false)
    const [propsSuccess, setPropsSuccess] = useState(false)
    const [propsFilter, setPropsFilter] = useState("")

    // Whitelist state
    const [whitelist, setWhitelist] = useState<string[]>([])
    const [whitelistInput, setWhitelistInput] = useState("")
    const [whitelistLoaded, setWhitelistLoaded] = useState(false)
    const [whitelistSaving, setWhitelistSaving] = useState(false)

    // Banlist state
    const [banlist, setBanlist] = useState<string[]>([])
    const [banlistInput, setBanlistInput] = useState("")
    const [banlistLoaded, setBanlistLoaded] = useState(false)
    const [banlistSaving, setBanlistSaving] = useState(false)

    // Settings state
    const [ramOption, setRamOption] = useState("")
    const [customRamMB, setCustomRamMB] = useState("")
    const [javaPath, setJavaPath] = useState("")
    const [settingsSaving, setSettingsSaving] = useState(false)
    const [settingsSuccess, setSettingsSuccess] = useState(false)

    // Stats state
    const [stats, setStats] = useState<ServerStats | null>(null)

    // EULA dialog state
    const [eulaDialogOpen, setEulaDialogOpen] = useState(false)

    // Delete dialog
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

    // Helper for tag colors and icons
    const getTagConfig = (tag: string) => {
        const lower = tag.toLowerCase()
        if (lower.includes("fabric")) return { color: "bg-stone-200/10 text-[#d6c2a3] border-stone-500/20 hover:bg-stone-500/20", icon: ScrollText }
        if (lower.includes("forge")) return { color: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20 hover:bg-indigo-500/20", icon: Anvil }
        if (lower.includes("neoforge")) return { color: "bg-orange-500/10 text-orange-300 border-orange-500/20 hover:bg-orange-500/20", icon: Zap }
        if (lower.includes("quilt")) return { color: "bg-purple-500/10 text-purple-300 border-purple-500/20 hover:bg-purple-500/20", icon: Layers }
        if (lower.includes("paper")) return { color: "bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20", icon: Send } 
        if (lower.includes("spigot")) return { color: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20 hover:bg-yellow-500/20", icon: Droplet }
        if (lower.includes("velocity")) return { color: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20 hover:bg-cyan-500/20", icon: Wind } 
        if (lower.includes("folia")) return { color: "bg-green-500/10 text-green-300 border-green-500/20 hover:bg-green-500/20", icon: Leaf }
        if (lower.includes("bukkit")) return { color: "bg-orange-700/10 text-orange-400 border-orange-700/20 hover:bg-orange-700/20", icon: Box }
        if (lower.includes("bungeecord")) return { color: "bg-yellow-600/10 text-yellow-400 border-yellow-600/20 hover:bg-yellow-600/20", icon: Layers }
        if (lower.includes("waterfall")) return { color: "bg-blue-600/10 text-blue-400 border-blue-600/20 hover:bg-blue-600/20", icon: Droplet }
        if (lower.includes("sponge")) return { color: "bg-yellow-400/10 text-yellow-300 border-yellow-400/20 hover:bg-yellow-400/20", icon: Square }
        if (lower.includes("purpur")) return { color: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20 hover:bg-fuchsia-500/20", icon: Box }
        return { color: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20 hover:bg-zinc-500/20", icon: Box }
    }

    // Files state
    const [files, setFiles] = useState<FileEntry[]>([])
    const [currentPath, setCurrentPath] = useState("")
    const [filesLoading, setFilesLoading] = useState(false)
    const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
    const [selectedFileMeta, setSelectedFileMeta] = useState<FileEntry | null>(null)
    const [fileContent, setFileContent] = useState("")
    const [fileLoading, setFileLoading] = useState(false)
    const [fileSaving, setFileSaving] = useState(false)
    const [fileError, setFileError] = useState<string | null>(null)
    const [fileDirty, setFileDirty] = useState(false)

    // Modrinth library state
    const [modrinthQuery, setModrinthQuery] = useState("")
    const [modrinthResults, setModrinthResults] = useState<ModrinthSearchHit[]>([])
    const [modrinthTotalHits, setModrinthTotalHits] = useState(0)
    const [modrinthSort, setModrinthSort] = useState<
        "relevance" | "downloads" | "updated" | "newest"
    >("relevance")
    const [modrinthPage, setModrinthPage] = useState(0)
    const [modrinthLoading, setModrinthLoading] = useState(false)
    const [modrinthError, setModrinthError] = useState<string | null>(null)
    const [modrinthInstalls, setModrinthInstalls] = useState<ModrinthInstallEntry[]>([])
    const [modrinthInstallsLoading, setModrinthInstallsLoading] = useState(false)
    const [modrinthInstalling, setModrinthInstalling] = useState<Record<string, boolean>>({})
    const [modrinthUpdating, setModrinthUpdating] = useState<Record<string, boolean>>({})
    const [modrinthRemoving, setModrinthRemoving] = useState<Record<string, boolean>>({})
    const [modrinthDetailOpen, setModrinthDetailOpen] = useState(false)
    const [modrinthDetailLoading, setModrinthDetailLoading] = useState(false)
    const [modrinthDetailError, setModrinthDetailError] = useState<string | null>(null)
    const [modrinthDetail, setModrinthDetail] = useState<ModrinthProjectDetails | null>(null)

    const [starting, setStarting] = useState(false)
    const [stopping, setStopping] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const isOnline = server?.status === "Online"
    const modrinthContext = useMemo(() => {
        if (!server) return null
        if (["Paper", "Purpur"].includes(server.framework)) {
            return { projectType: "plugin" as ModrinthProjectType, loader: "paper", label: "Plugins" }
        }
        if (server.framework === "Fabric") {
            return { projectType: "mod" as ModrinthProjectType, loader: "fabric", label: "Mods" }
        }
        if (server.framework === "Forge") {
            return { projectType: "mod" as ModrinthProjectType, loader: "forge", label: "Mods" }
        }
        return null
    }, [server])

    const installedProjectIds = useMemo(() => {
        return new Set(modrinthInstalls.map((entry) => entry.projectId))
    }, [modrinthInstalls])

    // Load server
    useEffect(() => {
        if (!id) return
        window.context.getServer(id).then((s) => {
            setServer(s)
            setLoading(false)
            if (s) {
                const ram = s.ramMB
                const presets = [2048, 4096, 6144, 8192, 12288, 16384]
                if (presets.includes(ram)) {
                    setRamOption(String(ram))
                } else {
                    setRamOption("custom")
                    setCustomRamMB(String(ram))
                }
                setJavaPath(s.javaPath || "")
            }
        })
    }, [id])

    // Console output subscriber
    useEffect(() => {
        if (!id) return

        // Fetch initial logs
        window.context.getServerLogs(id).then((logs) => {
            setConsoleLines((prev) => {
                const all = [...logs, ...prev];
                const seen = new Set();
                return all.filter((l) => {
                    const key = l.timestamp + l.text;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                }).slice(-500);
            });
        });

        const unsubscribe = window.context.onConsoleOutput((serverId, line) => {
            if (serverId === id) {
                setConsoleLines((prev) => [...prev.slice(-500), line])
            }
        })
        return unsubscribe
    }, [id])

    // Server status subscriber
    useEffect(() => {
        if (!id) return
        const unsubscribe = window.context.onServerStatus((update) => {
            if (update.serverId === id) {
                setServer((prev) => {
                    if (!prev) return prev
                    return {
                        ...prev,
                        status: update.status,
                        players: update.players || prev.players,
                    }
                })
            }
        })
        return unsubscribe
    }, [id])

    // Stats subscriber
    useEffect(() => {
        if (!id) return
        const unsubscribe = window.context.onServerStats((s) => {
            if (s.serverId === id) {
                setStats(s)
            }
        })
        return unsubscribe
    }, [id])

    // Reset stats when server goes offline
    useEffect(() => {
        if (!isOnline) setStats(null)
    }, [isOnline])

    // Auto-scroll console
    useEffect(() => {
        consoleEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [consoleLines])

    const handleStart = async () => {
        if (!id || !server) return
        // Check if EULA needs to be accepted (new servers or servers where it hasn't been accepted)
        // Treat eulaAccepted === undefined as true for backward compatibility with existing servers
        if (server.eulaAccepted === false) {
            setEulaDialogOpen(true)
            return
        }
        await doStartServer()
    }

    const doStartServer = async () => {
        if (!id) return
        setStarting(true)
        setError(null)
        const result = await window.context.startServer(id)
        if (!result.success) {
            setError(result.error || "Failed to start server")
        }
        setStarting(false)
    }

    const handleAcceptEula = async () => {
        if (!id) return
        setEulaDialogOpen(false)
        const result = await window.context.acceptEula(id)
        if (result.success) {
            setServer((prev) => prev ? { ...prev, eulaAccepted: true } : prev)
            await doStartServer()
        } else {
            setError(result.error || "Failed to accept EULA")
        }
    }

    const handleStop = async () => {
        if (!id) return
        setStopping(true)
        setError(null)
        const result = await window.context.stopServer(id)
        if (!result.success) {
            setError(result.error || "Failed to stop server")
        }
        setStopping(false)
    }

    const handleSendCommand = () => {
        if (!id || !commandInput.trim()) return
        window.context.sendCommand(id, commandInput.trim())
        setConsoleLines((prev) => [
            ...prev,
            {
                timestamp: new Date().toISOString(),
                text: `> ${commandInput.trim()}`,
                type: "system",
            },
        ])
        setCommandInput("")
    }

    const handleLoadProperties = async () => {
        if (!id || propsLoaded) return
        const props = await window.context.getServerProperties(id)
        setProperties(props)
        setPropsLoaded(true)
    }

    const handleSaveProperties = async () => {
        if (!id) return
        setPropsSaving(true)
        const result = await window.context.saveServerProperties(id, properties)
        setPropsSaving(false)
        if (result.success) {
            setPropsSuccess(true)
            setTimeout(() => setPropsSuccess(false), 3000)
        }
    }

    const handleLoadWhitelist = async () => {
        if (!id || whitelistLoaded) return
        const wl = await window.context.getWhitelist(id)
        setWhitelist(wl)
        setWhitelistLoaded(true)
    }

    const handleLoadBanlist = async () => {
        if (!id || banlistLoaded) return
        const bl = await window.context.getBanlist(id)
        setBanlist(bl)
        setBanlistLoaded(true)
    }

    const onContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, entry });
    };

    const handleRenameClick = () => {
        if (!contextMenu) return;
        setTargetEntry(contextMenu.entry);
        setFileActionInput(contextMenu.entry.name);
        setFileRenameDialogOpen(true);
    };

    const handleDuplicateClick = () => {
         if (!contextMenu) return;
        setTargetEntry(contextMenu.entry);
        const nameParts = contextMenu.entry.name.split(".");
        let newName = contextMenu.entry.name + "_copy";
        if (nameParts.length > 1) {
             const ext = nameParts.pop();
             newName = nameParts.join(".") + "_copy." + ext;
        }
        setFileActionInput(newName);
        setFileDuplicateDialogOpen(true);
    }

    const handleDeleteClick = () => {
         if (!contextMenu) return;
        setTargetEntry(contextMenu.entry);
        setFileDeleteDialogOpen(true);
    }

    const confirmRename = async () => {
        if (!id || !targetEntry) return;
        const relativePath = currentPath ? `${currentPath}/${targetEntry.name}` : targetEntry.name;
        await window.context.renameServerFile(id, relativePath, fileActionInput);
        handleLoadFiles(currentPath);
        setFileRenameDialogOpen(false);
    }

    const confirmDuplicate = async () => {
        if (!id || !targetEntry) return;
        const relativePath = currentPath ? `${currentPath}/${targetEntry.name}` : targetEntry.name;
        await window.context.copyServerFile(id, relativePath, fileActionInput);
        handleLoadFiles(currentPath);
        setFileDuplicateDialogOpen(false);
    }

    const confirmDelete = async () => {
         if (!id || !targetEntry) return;
        const relativePath = currentPath ? `${currentPath}/${targetEntry.name}` : targetEntry.name;
        await window.context.deleteServerFile(id, relativePath);
        handleLoadFiles(currentPath);
        setFileDeleteDialogOpen(false);
    }

    const handleLoadFiles = async (relativePath = "") => {
        if (!id) return
        setFilesLoading(true)
        const entries = await window.context.listServerFiles(id, relativePath)
        setFiles(entries)
        setCurrentPath(relativePath)
        setFilesLoading(false)
    }

    const handleNavigateFile = (entry: FileEntry) => {
        if (entry.isDirectory) {
            const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name
            handleLoadFiles(newPath)
            return
        }

        const filePath = currentPath ? `${currentPath}/${entry.name}` : entry.name
        handleOpenFile(filePath, entry)
    }

    const handleNavigateUp = () => {
        const parts = currentPath.split("/").filter(Boolean)
        parts.pop()
        handleLoadFiles(parts.join("/"))
    }

    const ALLOWED_EXTENSIONS = [
        ".txt", ".json", ".yml", ".yaml", ".properties", ".log", ".md", ".toml", ".sh", ".bat", ".xml", ".ini", ".cfg", ".conf"
    ];

    const handleOpenFile = async (filePath: string, entry?: FileEntry) => {
        if (!id) return

        const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
        const isText = ALLOWED_EXTENSIONS.includes(ext) || !filePath.includes("."); // Allowed known extensions or no extension (often config files)
        
        // Explicitly block binaries
        const BLOCKED_EXTENSIONS = [".jar", ".zip", ".exe", ".dat", ".lock", ".gz", ".tar"];
        if (BLOCKED_EXTENSIONS.includes(ext)) {
            setFileError("Cannot open binary files in the editor.");
            return;
        }

        if (!isText && !confirm("This file type might not be text. Open anyway?")) {
            return;
        }

        setFileError(null)
        setFileLoading(true)
        const result = await window.context.readServerFile(id, filePath)
        setFileLoading(false)
        if (!result.success) {
            setFileError(result.error || "Unable to read file")
            return
        }
        setSelectedFilePath(filePath)
        setSelectedFileMeta(entry || null)
        setFileContent(result.content ?? "")
        setFileDirty(false)
    }

    const handleSaveFile = async () => {
        if (!id || !selectedFilePath) return
        setFileSaving(true)
        const result = await window.context.writeServerFile(id, selectedFilePath, fileContent)
        setFileSaving(false)
        if (!result.success) {
            setFileError(result.error || "Unable to save file")
            return
        }
        setFileDirty(false)
        await handleLoadFiles(currentPath)
    }

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return "—"
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const pathSegments = currentPath.split("/").filter(Boolean)

    const handleSaveWhitelist = async () => {
        if (!id) return
        setWhitelistSaving(true)
        const result = await window.context.saveWhitelist(id, whitelist)
        setWhitelistSaving(false)
        if (!result.success) {
            setError(result.error || "Failed to save whitelist")
            return
        }
        if (isOnline) {
            window.context.sendCommand(id, "whitelist reload")
        }
    }

    const handleSaveBanlist = async () => {
        if (!id) return
        setBanlistSaving(true)
        const result = await window.context.saveBanlist(id, banlist)
        setBanlistSaving(false)
        if (!result.success) {
            setError(result.error || "Failed to save banlist")
            return
        }
        if (isOnline) {
            window.context.sendCommand(id, "banlist reload")
        }
    }

    const loadModrinthInstalls = useCallback(async () => {
        if (!id || !modrinthContext) return
        setModrinthInstallsLoading(true)
        try {
            const installs = await window.context.listModrinthInstalls(
                id,
                modrinthContext.projectType
            )
            setModrinthInstalls(installs)
        } finally {
            setModrinthInstallsLoading(false)
        }
    }, [id, modrinthContext])

    // Load Modrinth installs for this server
    useEffect(() => {
        if (!id || !modrinthContext) return
        loadModrinthInstalls()
    }, [id, modrinthContext, loadModrinthInstalls])

    const handleSearchModrinth = useCallback(async (pageOverride?: number) => {
        if (!modrinthContext || !server) return
        const page = pageOverride ?? modrinthPage
        if (pageOverride != null) {
            setModrinthPage(pageOverride)
        }
        setModrinthLoading(true)
        setModrinthError(null)
        try {
            const result = await window.context.searchModrinth({
                query: modrinthQuery.trim(),
                projectType: modrinthContext.projectType,
                loader: modrinthContext.loader,
                gameVersion: server.version,
                limit: 20,
                offset: page * 20,
                sort: modrinthSort,
            })
            setModrinthResults(result.hits)
            setModrinthTotalHits(result.totalHits)
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Search failed"
            setModrinthError(msg)
        } finally {
            setModrinthLoading(false)
        }
    }, [modrinthContext, modrinthQuery, modrinthPage, modrinthSort, server])

    const handleInstallModrinth = async (hit: ModrinthSearchHit) => {
        if (!id || !modrinthContext || !server) return
        setModrinthInstalling((prev) => ({ ...prev, [hit.projectId]: true }))
        const result = await window.context.installModrinthProject(id, {
            projectId: hit.projectId,
            projectType: modrinthContext.projectType,
            loader: modrinthContext.loader,
            gameVersion: server.version,
            title: hit.title,
            slug: hit.slug,
            iconUrl: hit.iconUrl,
        })
        setModrinthInstalling((prev) => ({ ...prev, [hit.projectId]: false }))
        if (!result.success) {
            setError(result.error || "Failed to install")
            return
        }
        await loadModrinthInstalls()
    }

    const handleUpdateModrinth = async (entry: ModrinthInstallEntry) => {
        if (!id || !modrinthContext || !server) return
        setModrinthUpdating((prev) => ({ ...prev, [entry.projectId]: true }))
        const result = await window.context.updateModrinthInstall(id, {
            projectId: entry.projectId,
            projectType: entry.projectType,
            loader: entry.loader ?? modrinthContext.loader,
            gameVersion: entry.gameVersion ?? server.version,
            title: entry.title,
            slug: entry.slug,
        })
        setModrinthUpdating((prev) => ({ ...prev, [entry.projectId]: false }))
        if (!result.success) {
            setError(result.error || "Failed to update")
            return
        }
        await loadModrinthInstalls()
    }

    const handleRemoveModrinth = async (entry: ModrinthInstallEntry) => {
        if (!id) return
        setModrinthRemoving((prev) => ({ ...prev, [entry.projectId]: true }))
        const result = await window.context.removeModrinthInstall(id, entry.projectId)
        setModrinthRemoving((prev) => ({ ...prev, [entry.projectId]: false }))
        if (!result.success) {
            setError(result.error || "Failed to remove")
            return
        }
        await loadModrinthInstalls()
    }

    const handleOpenModrinth = (entry: { slug: string; projectType: ModrinthProjectType }) => {
        const url = `https://modrinth.com/${entry.projectType}/${entry.slug}`
        window.context.openExternal(url)
    }

    const handleOpenModrinthDetails = async (hit: ModrinthSearchHit) => {
        setModrinthDetailOpen(true)
        setModrinthDetail(null)
        setModrinthDetailError(null)
        setModrinthDetailLoading(true)
        try {
            const detail = await window.context.getModrinthProject(hit.projectId)
            setModrinthDetail(detail)
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to load details"
            setModrinthDetailError(msg)
        } finally {
            setModrinthDetailLoading(false)
        }
    }

    const handleSaveSettings = async () => {
        if (!id) return
        const effectiveRam =
            ramOption === "custom"
                ? parseInt(customRamMB, 10) || 0
                : parseInt(ramOption, 10)
        if (effectiveRam < 512) return

        setSettingsSaving(true)
        const result = await window.context.updateServerSettings(id, {
            ramMB: effectiveRam,
            javaPath: javaPath.trim() || undefined
        })
        setSettingsSaving(false)
        if (result.success) {
            setServer((prev) =>
                prev ? { ...prev, ramMB: effectiveRam, javaPath: javaPath.trim() || undefined } : prev
            )
            setSettingsSuccess(true)
            setTimeout(() => setSettingsSuccess(false), 3000)
        }
    }

    const handleDeleteServer = async () => {
        if (!id) return
        const result = await window.context.deleteServer(id)
        if (!result.success) {
            setError(result.error || "Failed to delete server")
            return
        }
        navigate("/servers")
    }

    const formatRam = (ramMB: number) => {
        if (ramMB >= 1024 && ramMB % 1024 === 0) return `${ramMB / 1024} GB`
        if (ramMB >= 1024) return `${(ramMB / 1024).toFixed(1)} GB`
        return `${ramMB} MB`
    }

    const renderAnsiText = (text: string) => {
        const segments: JSX.Element[] = []
        const regex = /\x1b\[([0-9;]*)m/g
        let lastIndex = 0
        let color: string | null = null
        let match: RegExpExecArray | null
        let keyIndex = 0

        while ((match = regex.exec(text)) !== null) {
            const chunk = text.slice(lastIndex, match.index)
            if (chunk) {
                segments.push(
                    <span key={`ansi-${keyIndex++}`} style={{ color: color ?? undefined }}>
                        {chunk}
                    </span>
                )
            }

            const params = match[1]
                .split(";")
                .map((value) => parseInt(value, 10))
                .filter((value) => !Number.isNaN(value))

            if (params.length === 0 || params.includes(0) || params.includes(39)) {
                color = null
            } else {
                const colorIndex = params.indexOf(38)
                if (colorIndex !== -1 && params[colorIndex + 1] === 2) {
                    const r = params[colorIndex + 2]
                    const g = params[colorIndex + 3]
                    const b = params[colorIndex + 4]
                    if ([r, g, b].every((value) => typeof value === "number" && !Number.isNaN(value))) {
                        color = `rgb(${r}, ${g}, ${b})`
                    }
                }
            }

            lastIndex = regex.lastIndex
        }

        const tail = text.slice(lastIndex)
        if (tail) {
            segments.push(
                <span key={`ansi-${keyIndex++}`} style={{ color: color ?? undefined }}>
                    {tail}
                </span>
            )
        }

        return segments
    }

    const filteredProperties = useMemo(() => {
        const needle = propsFilter.trim().toLowerCase()
        return properties
            .map((prop, index) => ({ prop, index }))
            .filter(({ prop }) => {
                if (prop.comment) return false
                if (!needle) return true
                return prop.key.toLowerCase().includes(needle)
            })
    }, [properties, propsFilter])

    const memoryMax = stats?.memoryMaxMB ?? server?.ramMB ?? null
    const memoryUsed = stats?.memoryUsedMB ?? null
    const supportsInServerStats = server
        ? ["Paper", "Purpur"].includes(server.framework)
        : false
    const memoryPercent =
        memoryUsed != null && memoryMax
            ? Math.min(100, Math.max(0, Math.round((memoryUsed / memoryMax) * 100)))
            : null

    if (loading) {
        return (
            <section className="flex items-center justify-center h-full">
                <Spinner className="text-primary" />
            </section>
        )
    }

    if (!server) {
        return (
            <section className="flex flex-col items-center justify-center gap-4 h-full">
                <p className="text-muted-foreground">Server not found</p>
                <Button variant="ghost" onClick={() => navigate("/servers")}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to servers
                </Button>
            </section>
        )
    }

    return (
        <section className="flex flex-col gap-6 px-10 pb-10 pt-4">
            {/* Header */}
            <header className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/servers")}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-semibold">
                            {server.name}
                        </h1>
                        <span className="text-xs text-muted-foreground">
                            {server.framework} {server.version} &bull;{" "}
                            {formatRam(server.ramMB)}
                        </span>
                    </div>
                    <Badge
                        variant={isOnline ? "default" : "destructive"}
                    >
                        {server.status}
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => id && window.context.openServerFolder(id)}
                    >
                        <FolderOpen className="h-4 w-4 mr-1" />
                        Open folder
                    </Button>
                    {isOnline ? (
                        <Button
                            variant="destructive"
                            onClick={handleStop}
                            disabled={stopping}
                        >
                            {stopping ? (
                                <Spinner className="mr-2" />
                            ) : (
                                <Square className="h-4 w-4 mr-1" />
                            )}
                            {stopping ? "Stopping..." : "Stop"}
                        </Button>
                    ) : (
                        <Button
                            className="bg-cyan-400 text-black hover:bg-cyan-300"
                            onClick={handleStart}
                            disabled={starting}
                        >
                            {starting ? (
                                <Spinner className="mr-2" />
                            ) : (
                                <Play className="h-4 w-4 mr-1" />
                            )}
                            {starting ? "Starting..." : "Start"}
                        </Button>
                    )}
                </div>
            </header>

            {error && (
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        {error}
                    </AlertDescription>
                </Alert>
            )}

            {/* Stats cards - always visible */}
            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <CardContent className="flex items-center gap-4 p-5">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${isOnline ? "bg-primary/10" : "bg-muted"}`}>
                            <Users className={`h-6 w-6 ${isOnline ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Players</p>
                            <p className="text-2xl font-semibold">
                                {isOnline
                                    ? stats ? `${stats.playerCount}/${stats.maxPlayers}` : "0/20"
                                    : "—"
                                }
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-5">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${isOnline ? "bg-primary/10" : "bg-muted"}`}>
                            <Gauge className={`h-6 w-6 ${isOnline ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">TPS</p>
                            <p className={`text-2xl font-semibold ${
                                isOnline && stats?.tps != null
                                    ? stats.tps >= 18
                                        ? "text-primary"
                                        : stats.tps >= 15
                                          ? "text-yellow-400"
                                          : "text-destructive"
                                    : ""
                            }`}>
                                {isOnline
                                    ? supportsInServerStats
                                        ? stats?.tps != null ? stats.tps.toFixed(1) : "..."
                                        : "n/a"
                                    : "—"
                                }
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-5">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${isOnline ? "bg-primary/10" : "bg-muted"}`}>
                            <MemoryStick className={`h-6 w-6 ${isOnline ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Memory</p>
                            <p className="text-2xl font-semibold">
                                {isOnline && memoryUsed != null
                                    ? `${memoryUsed} / ${memoryMax ?? "?"} MB`
                                    : server ? formatRam(server.ramMB) : "—"
                                }
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span>
                                    {isOnline && memoryUsed != null
                                        ? supportsInServerStats
                                            ? "used / max"
                                            : "rss / limit"
                                        : "allocated"}
                                </span>
                                {isOnline && memoryPercent != null && (
                                    <span>{memoryPercent}%</span>
                                )}
                            </div>
                            {isOnline && memoryPercent != null && (
                                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                                    <div
                                        className="h-full rounded-full bg-primary"
                                        style={{ width: `${memoryPercent}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="console">
                <TabsList>
                    <TabsTrigger value="console">Console</TabsTrigger>
                    <TabsTrigger
                        value="properties"
                        onClick={handleLoadProperties}
                    >
                        Properties
                    </TabsTrigger>
                    <TabsTrigger
                        value="players"
                        onClick={() => {
                            handleLoadWhitelist()
                            handleLoadBanlist()
                        }}
                    >
                        Players
                    </TabsTrigger>
                    <TabsTrigger value="library">Library</TabsTrigger>
                    <TabsTrigger value="files" onClick={() => handleLoadFiles(currentPath)}>
                        Files
                    </TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                {/* Console Tab */}
                <TabsContent value="console">
                    <Card>
                        <CardContent className="p-0">
                            <div className="h-[550px] overflow-auto bg-black font-mono text-xs text-zinc-300 select-text p-4 rounded-t-lg">
                                {consoleLines.length === 0 ? (
                                    <p className="text-muted-foreground">
                                        {isOnline
                                            ? "Waiting for output..."
                                            : "Start the server to see console output"}
                                    </p>
                                ) : (
                                    consoleLines.map((line, i) => (
                                        <div
                                            key={i}
                                            className={
                                                line.type === "stderr"
                                                    ? "text-red-400"
                                                    : line.type === "system"
                                                      ? "text-cyan-400"
                                                      : "text-zinc-300"
                                            }
                                        >
                                            {renderAnsiText(line.text)}
                                        </div>
                                    ))
                                )}
                                <div ref={consoleEndRef} />
                            </div>
                            <div className="flex gap-2 p-3 border-t border-border">
                                <Input
                                    value={commandInput}
                                    onChange={(e) =>
                                        setCommandInput(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter")
                                            handleSendCommand()
                                    }}
                                    placeholder={
                                        isOnline
                                            ? "Type a command..."
                                            : "Server is offline"
                                    }
                                    disabled={!isOnline}
                                    className="font-mono text-xs"
                                />
                                <Button
                                    size="sm"
                                    onClick={handleSendCommand}
                                    disabled={
                                        !isOnline || !commandInput.trim()
                                    }
                                    className="bg-cyan-400 text-black hover:bg-cyan-300"
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Properties Tab */}
                <TabsContent value="properties">
                    <Card>
                        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <CardTitle>Server Properties</CardTitle>
                                <CardDescription>
                                    Fine-tune server.properties values
                                </CardDescription>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <Input
                                    value={propsFilter}
                                    onChange={(e) => setPropsFilter(e.target.value)}
                                    placeholder="Search properties"
                                    className="h-9 w-full sm:w-[220px]"
                                />
                                <Button
                                    className="bg-cyan-400 text-black hover:bg-cyan-300"
                                    onClick={handleSaveProperties}
                                    disabled={propsSaving}
                                >
                                    {propsSaving ? (
                                        <Spinner className="mr-2" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-1" />
                                    )}
                                    Save
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {propsSuccess && (
                                <Alert className="mb-4 border-cyan-400/30 bg-cyan-400/10">
                                    <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                                    <AlertTitle className="text-cyan-300">
                                        Saved
                                    </AlertTitle>
                                    <AlertDescription className="text-cyan-300/70">
                                        Restart the server for changes to take
                                        effect.
                                    </AlertDescription>
                                </Alert>
                            )}
                            {properties.length === 0 ? (
                                <div className="flex items-center gap-2 text-white/50 text-sm">
                                    <Info className="h-4 w-4" />
                                    <span>
                                        No server.properties file found. Start
                                        the server once to generate it.
                                    </span>
                                </div>
                            ) : (
                                <div>
                                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 text-[11px] uppercase tracking-[0.2em] text-white/50">
                                        <span>Property</span>
                                        <span>Value</span>
                                    </div>
                                    <div className="mt-3 flex flex-col gap-2 max-h-[400px] overflow-auto">
                                        {filteredProperties.map(({ prop, index }) => (
                                            <div
                                                key={`${prop.key}-${index}`}
                                                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-3 w-3 text-cyan-400" />
                                                    <span className="text-xs text-white/70 font-mono truncate">
                                                        {prop.key}
                                                    </span>
                                                </div>
                                                <Input
                                                    value={prop.value}
                                                    onChange={(e) => {
                                                        const updated = [...properties]
                                                        updated[index] = {
                                                            ...updated[index],
                                                            value: e.target.value,
                                                        }
                                                        setProperties(updated)
                                                    }}
                                                    className="text-xs font-mono h-8"
                                                />
                                            </div>
                                        ))}
                                        {filteredProperties.length === 0 && (
                                            <p className="text-xs text-white/50">No properties match that search.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Players Tab */}
                <TabsContent value="players">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Whitelist */}
                        <Card>
                            <CardHeader className="flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">
                                        Whitelist
                                    </CardTitle>
                                    <CardDescription>
                                        {whitelist.length} player
                                        {whitelist.length !== 1 ? "s" : ""}
                                    </CardDescription>
                                </div>
                                <Button
                                    size="sm"
                                    className="bg-cyan-400 text-black hover:bg-cyan-300"
                                    onClick={handleSaveWhitelist}
                                    disabled={whitelistSaving}
                                >
                                    {whitelistSaving ? (
                                        <Spinner className="mr-1" />
                                    ) : (
                                        <Save className="h-3 w-3 mr-1" />
                                    )}
                                    Save
                                </Button>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <div className="flex gap-2">
                                    <Input
                                        value={whitelistInput}
                                        onChange={(e) =>
                                            setWhitelistInput(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === "Enter" &&
                                                whitelistInput.trim()
                                            ) {
                                                setWhitelist((prev) => [
                                                    ...prev,
                                                    whitelistInput.trim(),
                                                ])
                                                setWhitelistInput("")
                                            }
                                        }}
                                        placeholder="Player name"
                                        className="text-xs h-8"
                                    />
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            if (whitelistInput.trim()) {
                                                setWhitelist((prev) => [
                                                    ...prev,
                                                    whitelistInput.trim(),
                                                ])
                                                setWhitelistInput("")
                                            }
                                        }}
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                                <div className="flex flex-col gap-1 max-h-[250px] overflow-auto">
                                    {whitelist.map((player, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs"
                                        >
                                            <span>{player}</span>
                                            <button
                                                className="text-white/40 hover:text-rose-400 transition"
                                                onClick={() =>
                                                    setWhitelist((prev) =>
                                                        prev.filter(
                                                            (_, j) => j !== i
                                                        )
                                                    )
                                                }
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                    {whitelist.length === 0 && (
                                        <p className="text-xs text-white/50">
                                            No players whitelisted
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Banlist */}
                        <Card>
                            <CardHeader className="flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">
                                        Banlist
                                    </CardTitle>
                                    <CardDescription>
                                        {banlist.length} player
                                        {banlist.length !== 1 ? "s" : ""}
                                    </CardDescription>
                                </div>
                                <Button
                                    size="sm"
                                    className="bg-cyan-400 text-black hover:bg-cyan-300"
                                    onClick={handleSaveBanlist}
                                    disabled={banlistSaving}
                                >
                                    {banlistSaving ? (
                                        <Spinner className="mr-1" />
                                    ) : (
                                        <Save className="h-3 w-3 mr-1" />
                                    )}
                                    Save
                                </Button>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <div className="flex gap-2">
                                    <Input
                                        value={banlistInput}
                                        onChange={(e) =>
                                            setBanlistInput(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === "Enter" &&
                                                banlistInput.trim()
                                            ) {
                                                setBanlist((prev) => [
                                                    ...prev,
                                                    banlistInput.trim(),
                                                ])
                                                setBanlistInput("")
                                            }
                                        }}
                                        placeholder="Player name"
                                        className="text-xs h-8"
                                    />
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            if (banlistInput.trim()) {
                                                setBanlist((prev) => [
                                                    ...prev,
                                                    banlistInput.trim(),
                                                ])
                                                setBanlistInput("")
                                            }
                                        }}
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                                <div className="flex flex-col gap-1 max-h-[250px] overflow-auto">
                                    {banlist.map((player, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs"
                                        >
                                            <span>{player}</span>
                                            <button
                                                className="text-white/40 hover:text-rose-400 transition"
                                                onClick={() =>
                                                    setBanlist((prev) =>
                                                        prev.filter(
                                                            (_, j) => j !== i
                                                        )
                                                    )
                                                }
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                    {banlist.length === 0 && (
                                        <p className="text-xs text-white/50">
                                            No players banned
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Library Tab */}
                <TabsContent value="library" className="max-h-[740px] overflow-auto pr-1">
                    {!modrinthContext ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Modrinth Library</CardTitle>
                                <CardDescription>
                                    This server type does not support Modrinth
                                    plugins or mods.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    ) : (
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                            <Card>
                                <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <CardTitle>Modrinth {modrinthContext.label}</CardTitle>
                                        <CardDescription>
                                            Search and install for {server?.version}
                                        </CardDescription>
                                    </div>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <Input
                                            value={modrinthQuery}
                                            onChange={(e) => {
                                                setModrinthQuery(e.target.value)
                                                setModrinthPage(0)
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    handleSearchModrinth(0)
                                                }
                                            }}
                                            placeholder={`Search ${modrinthContext.label.toLowerCase()}`}
                                            className="h-9 w-full sm:w-[240px]"
                                        />
                                        <Select value={modrinthSort} onValueChange={(value) => {
                                            setModrinthSort(value as typeof modrinthSort)
                                            setModrinthPage(0)
                                        }}>
                                            <SelectTrigger className="h-9 w-[140px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="relevance">Relevance</SelectItem>
                                                <SelectItem value="downloads">Downloads</SelectItem>
                                                <SelectItem value="updated">Updated</SelectItem>
                                                <SelectItem value="newest">Newest</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            size="sm"
                                            className="bg-cyan-400 text-black hover:bg-cyan-300"
                                            onClick={handleSearchModrinth}
                                            disabled={modrinthLoading}
                                        >
                                            {modrinthLoading ? <Spinner className="mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                                            Search
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-3">
                                    {modrinthError && (
                                        <Alert variant="destructive">
                                            <AlertTitle>Error</AlertTitle>
                                            <AlertDescription>{modrinthError}</AlertDescription>
                                        </Alert>
                                    )}
                                    {modrinthResults.length === 0 ? (
                                        <div className="flex items-center gap-2 text-white/50 text-sm">
                                            <Info className="h-4 w-4" />
                                            <span>Run a search to see results.</span>
                                        </div>
                                    ) : (
                                        <div className="max-h-[600px] overflow-auto pr-2 custom-scrollbar">
                                            <div className="flex flex-col gap-3">
                                                {modrinthResults.map((hit) => (
                                                <div
                                                    key={hit.projectId}
                                                    className="group relative flex flex-row w-full items-stretch gap-4 rounded-xl border border-white/10 bg-[#1e1e1e] p-3 transition-all hover:border-white/20 hover:bg-white/5 cursor-pointer"
                                                    onClick={() => handleOpenModrinthDetails(hit)}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") handleOpenModrinthDetails(hit)
                                                    }}
                                                >
                                                    {/* Left: Icon Frame */}
                                                    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-[#2b2b2b] p-2 border border-white/5 overflow-hidden">
                                                         <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-white/10 z-0 select-none">
                                                            {hit.title.charAt(0).toUpperCase()}
                                                         </div>
                                                         <img
                                                                src={hit.iconUrl || `https://cdn.modrinth.com/data/${hit.projectId}/icon.png`}
                                                                alt={hit.title}
                                                                className="relative z-10 h-full w-full object-contain rounded-md"
                                                                onError={(e) => {
                                                                    e.currentTarget.style.display = 'none'
                                                                }}
                                                            />
                                                    </div>

                                                    {/* Middle: Content */}
                                                    <div className="flex flex-1 flex-col justify-between py-1 min-w-0">
                                                        <div>
                                                            <div className="flex items-baseline gap-2">
                                                                <h3 className="text-base font-bold text-white underline decoration-white/30 underline-offset-4 truncate">{hit.title}</h3>
                                                                <span className="text-xs text-white/50 truncate">by {hit.author}</span>
                                                            </div>
                                                            <p className="mt-1 line-clamp-2 text-sm text-white/60 leading-snug">
                                                                {hit.description}
                                                            </p>
                                                        </div>
                                                        
                                                        {/* Tags */}
                                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                                            {/* Client/Server Tag */}
                                                            {(hit.clientSide !== 'unsupported' || hit.serverSide !== 'unsupported') && (
                                                                <Badge variant="outline" className="flex items-center gap-1.5 border-white/10 bg-zinc-500/10 text-zinc-300 hover:bg-zinc-500/20 px-2 py-0.5 font-normal">
                                                                    <Globe className="h-3 w-3" />
                                                                    <span>
                                                                        {hit.clientSide === 'required' && hit.serverSide === 'required' ? 'Client & Server' :
                                                                         hit.clientSide === 'required' ? 'Client' :
                                                                         hit.serverSide === 'required' ? 'Server' : 'Client or Server'}
                                                                    </span>
                                                                </Badge>
                                                            )}
                                                            
                                                            {/* Categories */}
                                                            {(() => {
                                                                const loaders = ['fabric', 'forge', 'neoforge', 'quilt', 'paper', 'spigot', 'folia', 'bukkit', 'bungeecord', 'velocity', 'waterfall', 'sponge', 'purpur'];
                                                                const allCats = hit.categories || [];
                                                                const sortedCats = [...allCats].sort((a, b) => {
                                                                    const isLoaderA = loaders.includes(a.toLowerCase());
                                                                    const isLoaderB = loaders.includes(b.toLowerCase());
                                                                    // Loaders go last
                                                                    if (isLoaderA && !isLoaderB) return 1;
                                                                    if (!isLoaderA && isLoaderB) return -1;
                                                                    return a.localeCompare(b);
                                                                });

                                                                const visible = sortedCats.slice(0, 6);
                                                                const overflow = sortedCats.slice(6);
                                                                
                                                                return (
                                                                    <>
                                                                        {visible.map(cat => {
                                                                            const config = getTagConfig(cat);
                                                                            const Icon = config.icon;
                                                                            return (
                                                                                <Badge key={cat} variant="outline" className={`flex items-center gap-1.5 px-2 py-0.5 font-normal ${config.color}`}>
                                                                                    <Icon className="h-3 w-3" />
                                                                                    <span className="capitalize">{cat}</span>
                                                                                </Badge>
                                                                            )
                                                                        })}

                                                                        {/* Overflow Badge */}
                                                                        {overflow.length > 0 && (
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <Badge variant="outline" className="flex items-center gap-1 border-white/10 bg-zinc-500/10 text-zinc-300 hover:bg-zinc-500/20 px-2 py-0.5 font-normal cursor-help">
                                                                                            <Plus className="h-3 w-3" />
                                                                                            <span>{overflow.length}</span>
                                                                                        </Badge>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent side="bottom" className="bg-[#1e1e1e] border border-white/10 p-2">
                                                                                        <div className="flex flex-wrap gap-2 max-w-[200px]">
                                                                                            {overflow.map(cat => {
                                                                                                const config = getTagConfig(cat);
                                                                                                const Icon = config.icon;
                                                                                                return (
                                                                                                    <Badge key={cat} variant="outline" className={`flex items-center gap-1.5 px-2 py-0.5 font-normal ${config.color}`}>
                                                                                                        <Icon className="h-3 w-3" />
                                                                                                        <span className="capitalize">{cat}</span>
                                                                                                    </Badge>
                                                                                                )
                                                                                            })}
                                                                                        </div>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>

                                                    {/* Right: Metadata & Actions */}
                                                    <div className="flex shrink-0 flex-col items-end justify-between py-1 pl-4 min-w-[140px]">
                                                        {/* Top Right: Stats */}
                                                        <div className="flex items-center gap-4 text-xs font-medium text-white/50">
                                                             <div className="flex items-center gap-1.5" title={`${hit.downloads} Downloads`}>
                                                                 <Download className="h-3.5 w-3.5" />
                                                                 <span>
                                                                    {Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(hit.downloads)}
                                                                 </span>
                                                             </div>
                                                             <div className="flex items-center gap-1.5" title={`${hit.follows} Follows`}>
                                                                 <Heart className="h-3.5 w-3.5" />
                                                                 <span>
                                                                    {Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(hit.follows)}
                                                                 </span>
                                                             </div>
                                                        </div>

                                                        {/* Action Button */}
                                                        <div onClick={e => e.stopPropagation()} className="my-1">
                                                             {installedProjectIds.has(hit.projectId) ? (
                                                                <Button size="sm" className="h-7 text-xs bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/20 cursor-default" disabled>
                                                                    Installed
                                                                </Button>
                                                            ) : modrinthInstalling[hit.projectId] ? (
                                                                <Button size="sm" variant="outline" className="h-7 text-xs" disabled>
                                                                    <Spinner className="mr-1.5 h-3 w-3" />
                                                                    Downloading
                                                                </Button>
                                                            ) : (
                                                                <Button size="sm" className="h-7 text-xs bg-white text-black hover:bg-zinc-200" onClick={() => handleInstallModrinth(hit)}>
                                                                    <Download className="h-3.5 w-3.5 mr-1.5" />
                                                                    Install
                                                                </Button>
                                                            )}
                                                        </div>

                                                        {/* Bottom Right: Timestamp */}
                                                        <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                                                            <Clock className="h-3 w-3" />
                                                            <span>
                                                                {(() => {
                                                                    const date = new Date(hit.dateModified);
                                                                    const now = new Date();
                                                                    const diffTime = Math.abs(now.getTime() - date.getTime());
                                                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                                                                    return diffDays > 30 
                                                                        ? date.toLocaleDateString() 
                                                                        : `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
                                                                })()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {modrinthTotalHits > 20 && (
                                        <div className="flex items-center justify-between pt-4 pb-2 text-xs text-white/50">
                                            <span>
                                                Page {modrinthPage + 1} of {Math.ceil(modrinthTotalHits / 20)}
                                            </span>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        const nextPage = Math.max(0, modrinthPage - 1)
                                                        handleSearchModrinth(nextPage)
                                                    }}
                                                    disabled={modrinthPage === 0 || modrinthLoading}
                                                    className="bg-zinc-800 border-white/10 text-white hover:bg-zinc-700 h-8"
                                                >
                                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                                    Prev
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        const nextPage = modrinthPage + 1
                                                        handleSearchModrinth(nextPage)
                                                    }}
                                                    disabled={modrinthLoading || (modrinthPage + 1) * 20 >= modrinthTotalHits}
                                                    className="bg-zinc-800 border-white/10 text-white hover:bg-zinc-700 h-8"
                                                >
                                                    Next
                                                    <ChevronRight className="h-4 w-4 ml-1" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-white">Installed {modrinthContext.label}</CardTitle>
                                        <CardDescription className="text-white/60">
                                            Manage installed {modrinthContext.label.toLowerCase()}
                                        </CardDescription>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={loadModrinthInstalls}
                                        disabled={modrinthInstallsLoading}
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-2">
                                    {modrinthInstallsLoading ? (
                                        <div className="flex items-center justify-center py-10">
                                            <Spinner className="text-cyan-400" />
                                        </div>
                                    ) : modrinthInstalls.length === 0 ? (
                                        <p className="text-xs text-white/50">Nothing installed yet.</p>
                                    ) : (
                                        <div className="flex flex-col gap-2 max-h-[420px] overflow-auto pr-1">
                                            {modrinthInstalls.map((entry) => (
                                                <div
                                                    key={entry.projectId}
                                                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="relative h-10 w-10 shrink-0">
                                                            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400/30 via-slate-900/60 to-slate-950/80 text-xs font-semibold text-emerald-100">
                                                                {entry.title.charAt(0).toUpperCase()}
                                                            </div>
                                                            {entry.iconUrl && (
                                                                <img
                                                                    src={entry.iconUrl}
                                                                    alt={entry.title}
                                                                    className="relative h-10 w-10 rounded-lg object-cover"
                                                                    onError={(e) => {
                                                                        e.currentTarget.style.opacity = "0"
                                                                    }}
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold truncate">{entry.title}</p>
                                                            <p className="text-[10px] text-white/40 truncate">
                                                                {entry.fileName}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {entry.slug && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleOpenModrinth({ slug: entry.slug!, projectType: entry.projectType })}
                                                            >
                                                                <ExternalLink className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleUpdateModrinth(entry)}
                                                            disabled={modrinthUpdating[entry.projectId]}
                                                        >
                                                            {modrinthUpdating[entry.projectId] ? (
                                                                <Spinner className="h-4 w-4" />
                                                            ) : (
                                                                <RefreshCw className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleRemoveModrinth(entry)}
                                                            disabled={modrinthRemoving[entry.projectId]}
                                                        >
                                                            {modrinthRemoving[entry.projectId] ? (
                                                                <Spinner className="h-4 w-4" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </TabsContent>

                {/* Files Tab */}
                <TabsContent value="files">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>File Explorer</CardTitle>
                                    <CardDescription>
                                        Browse server files and directories
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleLoadFiles(currentPath)}
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleLoadFiles("")}
                                    >
                                        root
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {/* Breadcrumb */}
                                <div className="flex items-center gap-1 mb-4 text-xs">
                                    <button
                                        className="text-cyan-300 hover:underline"
                                        onClick={() => handleLoadFiles("")}
                                    >
                                        root
                                    </button>
                                    {pathSegments.map((segment, i) => (
                                        <span key={i} className="flex items-center gap-1">
                                            <ChevronRight className="h-3 w-3 text-white/40" />
                                            <button
                                                className="text-cyan-300 hover:underline"
                                                onClick={() =>
                                                    handleLoadFiles(
                                                        pathSegments.slice(0, i + 1).join("/")
                                                    )
                                                }
                                            >
                                                {segment}
                                            </button>
                                        </span>
                                    ))}
                                </div>

                                {filesLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Spinner className="text-cyan-400" />
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1 max-h-[520px] overflow-auto">
                                        {/* Go up (..) */}
                                        {currentPath && (
                                            <button
                                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white/5"
                                                onClick={handleNavigateUp}
                                            >
                                                <Folder className="h-4 w-4 text-cyan-400" />
                                                <span className="text-sm text-white/50">..</span>
                                            </button>
                                        )}
                                        {files.map((entry) => {
                                            const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name
                                            const isSelected = selectedFilePath === entryPath
                                            return (
                                                <button
                                                    key={entry.name}
                                                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-white/5 ${
                                                        isSelected ? "bg-cyan-500/10 border border-cyan-400/30" : ""
                                                    }`}
                                                    onClick={() => handleNavigateFile(entry)}
                                                    onContextMenu={(e) => onContextMenu(e, entry)}
                                                    style={{
                                                        cursor: entry.isDirectory ? "pointer" : "default",
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {entry.isDirectory ? (
                                                            <Folder className="h-4 w-4 text-cyan-400" />
                                                        ) : (
                                                            <File className="h-4 w-4 text-white/40" />
                                                        )}
                                                        <span className="text-sm">
                                                            {entry.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-white/40">
                                                        <span>{entry.isDirectory ? "" : formatFileSize(entry.size)}</span>
                                                        <span className="w-[100px] text-right">
                                                            {new Date(entry.modifiedAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                        {files.length === 0 && !currentPath && (
                                            <div className="flex items-center gap-2 py-8 justify-center text-white/50 text-sm">
                                                <Info className="h-4 w-4" />
                                                <span>No files yet. Start the server once to generate files.</span>
                                            </div>
                                        )}
                                        {files.length === 0 && currentPath && (
                                            <p className="text-xs text-white/50 text-center py-8">
                                                This folder is empty
                                            </p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Quick Editor</CardTitle>
                                    <CardDescription>
                                        Edit server files without leaving the app
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => selectedFilePath && handleOpenFile(selectedFilePath, selectedFileMeta || undefined)}
                                        disabled={!selectedFilePath || fileLoading}
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        className="bg-cyan-400 text-black hover:bg-cyan-300"
                                        size="sm"
                                        onClick={handleSaveFile}
                                        disabled={!selectedFilePath || !fileDirty || fileSaving}
                                    >
                                        {fileSaving ? <Spinner className="mr-2" /> : <Save className="h-4 w-4 mr-1" />}
                                        Save
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {fileError && (
                                    <Alert className="mb-4 border-red-400/30 bg-red-400/10">
                                        <AlertTitle className="text-red-400">Editor error</AlertTitle>
                                        <AlertDescription className="text-red-400/80">
                                            {fileError}
                                        </AlertDescription>
                                    </Alert>
                                )}
                                {!selectedFilePath ? (
                                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-white/50 text-sm">
                                        <FileText className="h-5 w-5" />
                                        <span>Select a file to start editing</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between text-xs text-white/50">
                                            <span className="truncate">{selectedFilePath}</span>
                                            {selectedFileMeta && (
                                                <span>
                                                    {formatFileSize(selectedFileMeta.size)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="rounded-xl border border-white/10 bg-black/50">
                                            {fileLoading ? (
                                                <div className="flex items-center justify-center py-16">
                                                    <Spinner className="text-cyan-400" />
                                                </div>
                                            ) : (
                                                <textarea
                                                    value={fileContent}
                                                    onChange={(e) => {
                                                        setFileContent(e.target.value)
                                                        setFileDirty(true)
                                                    }}
                                                    spellCheck={false}
                                                    className="h-[360px] w-full resize-none bg-transparent p-3 text-xs font-mono text-white/90 outline-none select-text"
                                                />
                                            )}
                                        </div>
                                        {fileDirty && (
                                            <div className="text-[11px] text-cyan-300">
                                                Unsaved changes
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* File Context Menu & Modals */}
                    {contextMenu && (
                        <div
                            className="fixed z-50 min-w-[160px] rounded-lg border border-white/10 bg-[#1e1e24] p-1 shadow-xl animate-in fade-in zoom-in-95"
                            style={{ top: contextMenu.y, left: contextMenu.x }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button onClick={() => { if(contextMenu.entry.isDirectory) { handleLoadFiles(currentPath ? `${currentPath}/${contextMenu.entry.name}` : contextMenu.entry.name) } else { handleOpenFile(currentPath ? `${currentPath}/${contextMenu.entry.name}` : contextMenu.entry.name, contextMenu.entry) } setContextMenu(null) }} className="w-full text-left px-2 py-1.5 text-xs text-white hover:bg-white/10 rounded-md">Open</button>
                            <button onClick={handleRenameClick} className="w-full text-left px-2 py-1.5 text-xs text-white hover:bg-white/10 rounded-md">Rename</button>
                            <button onClick={handleDuplicateClick} className="w-full text-left px-2 py-1.5 text-xs text-white hover:bg-white/10 rounded-md">Duplicate</button>
                            <div className="h-[1px] bg-white/10 my-1" />
                            <button onClick={handleDeleteClick} className="w-full text-left px-2 py-1.5 text-xs text-red-400 hover:bg-white/10 rounded-md">Delete</button>
                        </div>
                    )}

                    <Dialog open={fileRenameDialogOpen} onOpenChange={setFileRenameDialogOpen}>
                        <DialogContent className="bg-[#121218] border-white/10">
                            <DialogHeader>
                                <DialogTitle className="text-white">Rename File</DialogTitle>
                                <DialogDescription>Enter a new name for the file.</DialogDescription>
                            </DialogHeader>
                            <Input 
                                value={fileActionInput} 
                                onChange={(e) => setFileActionInput(e.target.value)} 
                                className="bg-black/20 border-white/10 text-white font-mono" 
                            />
                            <div className="flex justify-end gap-2 mt-4">
                                <Button variant="ghost" onClick={() => setFileRenameDialogOpen(false)}>Cancel</Button>
                                <Button className="bg-cyan-500 text-black hover:bg-cyan-400" onClick={confirmRename}>Rename</Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={fileDuplicateDialogOpen} onOpenChange={setFileDuplicateDialogOpen}>
                        <DialogContent className="bg-[#121218] border-white/10">
                            <DialogHeader>
                                <DialogTitle className="text-white">Duplicate File</DialogTitle>
                                <DialogDescription>Enter a name for the copy.</DialogDescription>
                            </DialogHeader>
                            <Input 
                                value={fileActionInput} 
                                onChange={(e) => setFileActionInput(e.target.value)} 
                                className="bg-black/20 border-white/10 text-white font-mono" 
                            />
                            <div className="flex justify-end gap-2 mt-4">
                                <Button variant="ghost" onClick={() => setFileDuplicateDialogOpen(false)}>Cancel</Button>
                                <Button className="bg-cyan-500 text-black hover:bg-cyan-400" onClick={confirmDuplicate}>Duplicate</Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <AlertDialog open={fileDeleteDialogOpen} onOpenChange={setFileDeleteDialogOpen}>
                        <AlertDialogContent className="bg-[#121218] border-white/10">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete 
                                    <span className="text-cyan-400 font-mono mx-1">{targetEntry?.name}</span>.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </TabsContent>

                {/* Settings Tab */}
                <TabsContent value="settings">
                    <div className="grid gap-4 xl:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Performance</CardTitle>
                                <CardDescription>
                                    Changes require a server restart
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-4">
                                {settingsSuccess && (
                                    <Alert className="border-cyan-400/30 bg-cyan-400/10">
                                        <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                                        <AlertTitle className="text-cyan-300">
                                            Saved
                                        </AlertTitle>
                                        <AlertDescription className="text-cyan-300/70">
                                            Settings saved. Restart the server to
                                            apply.
                                        </AlertDescription>
                                    </Alert>
                                )}
                                <div className="grid gap-2">
                                    <label className="text-xs font-medium uppercase tracking-[0.2em] text-white/50">
                                        RAM
                                    </label>
                                    <Select
                                        value={ramOption}
                                        onValueChange={setRamOption}
                                    >
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="2048">
                                                2 GB
                                            </SelectItem>
                                            <SelectItem value="4096">
                                                4 GB
                                            </SelectItem>
                                            <SelectItem value="6144">
                                                6 GB
                                            </SelectItem>
                                            <SelectItem value="8192">
                                                8 GB
                                            </SelectItem>
                                            <SelectItem value="12288">
                                                12 GB
                                            </SelectItem>
                                            <SelectItem value="16384">
                                                16 GB
                                            </SelectItem>
                                            <SelectItem value="custom">
                                                Custom
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {ramOption === "custom" && (
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                min={512}
                                                max={32768}
                                                value={customRamMB}
                                                onChange={(e) =>
                                                    setCustomRamMB(e.target.value)
                                                }
                                                placeholder="e.g. 7168"
                                                className="w-[200px]"
                                            />
                                            <span className="text-xs text-white/50 whitespace-nowrap">
                                                MB
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-xs font-medium uppercase tracking-[0.2em] text-white/50">
                                        Java Path
                                    </label>
                                    <Input
                                        placeholder="System default (java)"
                                        value={javaPath}
                                        onChange={(e) => setJavaPath(e.target.value)}
                                        className="font-mono text-xs"
                                    />
                                    <p className="text-[11px] text-white/40">
                                        Path to the Java executable. Leave empty to use system default.
                                    </p>
                                </div>
                                <Button
                                    className="w-fit bg-cyan-400 text-black hover:bg-cyan-300"
                                    onClick={handleSaveSettings}
                                    disabled={settingsSaving}
                                >
                                    {settingsSaving ? (
                                        <Spinner className="mr-2" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-1" />
                                    )}
                                    Save settings
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Server Info</CardTitle>
                                <CardDescription>
                                    Quick reference and tools
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-4">
                                <div className="grid gap-2 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-white/50">Framework</span>
                                        <span className="font-medium">{server.framework}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-white/50">Version</span>
                                        <span className="font-medium">{server.version}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-white/50">Created</span>
                                        <span className="font-medium">
                                            {new Date(server.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-white/50">Path</span>
                                        <span className="font-medium truncate max-w-[220px] text-right">
                                            {server.serverPath}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant="ghost"
                                        onClick={() => id && window.context.openServerFolder(id)}
                                    >
                                        <FolderOpen className="h-4 w-4 mr-2" />
                                        Open folder
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={() => handleLoadFiles(currentPath)}
                                    >
                                        <FileText className="h-4 w-4 mr-2" />
                                        Refresh files
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="xl:col-span-2 border-red-400/30 bg-red-500/5">
                            <CardHeader>
                                <CardTitle>Danger Zone</CardTitle>
                                <CardDescription>
                                    This permanently removes the server and its files
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <p className="text-sm text-white/50">
                                    Deleting a server cannot be undone. Make sure you
                                    have backed up any important worlds or configs.
                                </p>
                                <Button
                                    className="w-fit bg-red-500 text-white hover:bg-red-600"
                                    onClick={() => setDeleteDialogOpen(true)}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete server
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>

            <Dialog open={modrinthDetailOpen} onOpenChange={setModrinthDetailOpen}>
                <DialogContent className="max-w-[800px] border-white/10 bg-[#0e1324] max-h-[85vh] overflow-y-auto custom-scrollbar">
                    <DialogHeader>
                        <DialogTitle>Modrinth Overview</DialogTitle>
                        <DialogDescription className="text-white/60">
                            Details, screenshots, and install status
                        </DialogDescription>
                    </DialogHeader>
                    {modrinthDetailLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Spinner className="text-primary" />
                        </div>
                    ) : modrinthDetailError ? (
                        <Alert variant="destructive" className="mt-4">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{modrinthDetailError}</AlertDescription>
                        </Alert>
                    ) : modrinthDetail ? (
                        <div className="mt-4 flex flex-col gap-6">
                            {/* Header Section */}
                            <div className="flex items-start gap-4">
                                <div className="relative h-20 w-20 shrink-0">
                                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#1c1c1c] text-2xl font-bold text-white/10 border border-white/5">
                                        {modrinthDetail.title.charAt(0).toUpperCase()}
                                    </div>
                                    {modrinthDetail.iconUrl && (
                                        <img
                                            src={modrinthDetail.iconUrl}
                                            alt={modrinthDetail.title}
                                            className="relative h-20 w-20 rounded-2xl object-contain bg-[#1c1c1c] border border-white/5"
                                            onError={(e) => {
                                                e.currentTarget.style.opacity = "0"
                                            }}
                                        />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-2xl font-bold text-white truncate">
                                        {modrinthDetail.title}
                                    </h2>
                                    <p className="text-base text-white/60 mt-1">
                                        {modrinthDetail.description}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/50">
                                        <Badge variant="secondary" className="bg-white/5 hover:bg-white/10 text-white/70 font-normal">
                                            <Download className="w-3 h-3 mr-1" />
                                            {modrinthDetail.downloads.toLocaleString()} downloads
                                        </Badge>
                                        <Badge variant="secondary" className="bg-white/5 hover:bg-white/10 text-white/70 font-normal">
                                            <Heart className="w-3 h-3 mr-1" />
                                            {modrinthDetail.followers.toLocaleString()} followers
                                        </Badge>
                                        {modrinthDetail.categories?.slice(0, 4).map((category) => (
                                            <Badge
                                                key={category}
                                                variant="outline"
                                                className="border-white/10 text-white/50 font-normal capitalize"
                                            >
                                                {category}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 shrink-0">
                                     {installedProjectIds.has(modrinthDetail.projectId) ? (
                                        <Button
                                            className="bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/20 cursor-default w-full"
                                            disabled
                                        >
                                            <Check className="h-4 w-4 mr-2" />
                                            Installed
                                        </Button>
                                    ) : modrinthInstalling[modrinthDetail.projectId] ? (
                                        <Button variant="outline" disabled className="w-full">
                                            <Spinner className="mr-2 h-4 w-4" />
                                            Downloading
                                        </Button>
                                    ) : (
                                        <Button
                                            className="bg-white text-black hover:bg-zinc-200 w-full"
                                            onClick={() =>
                                                handleInstallModrinth({
                                                    projectId: modrinthDetail.projectId,
                                                    slug: modrinthDetail.slug,
                                                    title: modrinthDetail.title,
                                                    description: modrinthDetail.description,
                                                    iconUrl: modrinthDetail.iconUrl,
                                                    downloads: modrinthDetail.downloads,
                                                    follows: modrinthDetail.followers,
                                                    author: "",
                                                    dateModified: "",
                                                })
                                            }
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            Install
                                        </Button>
                                    )}
                                    {modrinthDetail.slug && (
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-start text-white/50 hover:text-white"
                                            onClick={() => handleOpenModrinth({ slug: modrinthDetail.slug, projectType: modrinthContext?.projectType ?? "plugin" })}
                                        >
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                            View on Modrinth
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {modrinthDetail.gallery && modrinthDetail.gallery.length > 0 && (
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider">Gallery</h3>
                                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
                                        {modrinthDetail.gallery.map((image) => (
                                            <img
                                                key={image.url}
                                                src={image.url}
                                                alt={image.title || modrinthDetail.title}
                                                className="h-48 rounded-lg object-cover border border-white/10 bg-black/20 snap-start"
                                                loading="lazy"
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider">About</h3>
                                <div className="rounded-xl border border-white/10 bg-[#151925] p-6 text-sm text-white/80 leading-relaxed font-sans prose prose-invert max-w-none">
                                    {/* Rudimentary markdown support (converting newlines and links) would go here ideally */}
                                    {/* For now, preserving whitespace and basic structure */}
                                    <div className="whitespace-pre-wrap font-sans">
                                        {modrinthDetail.body || "No description provided."}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* EULA Dialog */}
            <AlertDialog open={eulaDialogOpen} onOpenChange={setEulaDialogOpen}>
                <AlertDialogContent className="border-white/10 bg-[#121218]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Minecraft EULA</AlertDialogTitle>
                        <AlertDialogDescription className="text-white/60">
                            By starting this server, you agree to the{" "}
                            <a
                                href="https://aka.ms/MinecraftEULA"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-300 underline hover:text-cyan-200"
                            >
                                Minecraft End User License Agreement
                            </a>
                            . You must accept the EULA before the server can start.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-cyan-400 text-black hover:bg-cyan-300"
                            onClick={handleAcceptEula}
                        >
                            Accept & Start
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent className="border-white/10 bg-[#121218]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete server "{server.name}"?</AlertDialogTitle>
                        <AlertDialogDescription className="text-white/60">
                            This action cannot be undone. The server folder and all data
                            will be permanently removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-500 text-white hover:bg-red-600"
                            onClick={handleDeleteServer}
                        >
                            Delete server
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    )
}
