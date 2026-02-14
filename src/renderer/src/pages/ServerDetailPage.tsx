import { useState, useEffect, useMemo, useCallback } from "react"
import { AnalyticsTab } from "@/components/AnalyticsTab"
import { ConsoleTab } from "@/components/ConsoleTab"
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
import { Alert, AlertDescription, AlertTitle, AlertAction } from "@/components/ui/alert"
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
    Archive,
    Trash2,
    RefreshCw,
    Clock,
    Send,
    Save,
    Plus,
    X,
    Info,
    CheckCircle2,
    Check,
    Users,
    Gauge,
    MemoryStick,
    File,
    Folder,
    ChevronRight,
    ChevronLeft,
    FileText,
    Download,
    ExternalLink,
    Search,
    Globe,
    Heart,
    Box,
    ScrollText,
    Anvil,
    Layers,
    Leaf,
    Droplet,
    Wind,
    Zap,
    Link,
} from "lucide-react"
import type {
    ServerRecord,
    ServerProperty,
    ServerStats,
    FileEntry,
    ModrinthSearchHit,
    ModrinthInstallEntry,
    ModrinthProjectType,
    ModrinthProjectDetails,
    BackupEntry,
    NgrokStatus,
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

    // Properties state
    const [properties, setProperties] = useState<ServerProperty[]>([])
    const [, setPropsLoaded] = useState(false)
    const [propsSaving, setPropsSaving] = useState(false)
    const [propsSuccess, setPropsSuccess] = useState(false)
    const [propsFilter, setPropsFilter] = useState("")

    // Whitelist state
    const [whitelist, setWhitelist] = useState<string[]>([])
    const [whitelistInput, setWhitelistInput] = useState("")
    const [, setWhitelistLoaded] = useState(false)
    const [whitelistSaving, setWhitelistSaving] = useState(false)

    // Banlist state
    const [banlist, setBanlist] = useState<string[]>([])
    const [banlistInput, setBanlistInput] = useState("")
    const [, setBanlistLoaded] = useState(false)
    const [banlistSaving, setBanlistSaving] = useState(false)

    // Settings state
    const [ramOption, setRamOption] = useState("")
    const [customRamMB, setCustomRamMB] = useState("")
    const [javaPath, setJavaPath] = useState("")
    const [settingsSaving, setSettingsSaving] = useState(false)
    const [settingsSuccess, setSettingsSuccess] = useState(false)
    const [maxRamMB, setMaxRamMB] = useState(16384)

    // Stats state
    const [stats, setStats] = useState<ServerStats | null>(null)

    // EULA dialog state
    const [eulaDialogOpen, setEulaDialogOpen] = useState(false)

    // Ngrok dialog state
    const [ngrokDialogOpen, setNgrokDialogOpen] = useState(false)
    const [ngrokInstalling, setNgrokInstalling] = useState(false)
    const [ngrokInstallProgress, setNgrokInstallProgress] = useState(0)
    const [ngrokStatus, setNgrokStatus] = useState<NgrokStatus | null>(null)
    const [ngrokAuthtoken, setNgrokAuthtoken] = useState("")
    const [ngrokAuthtokenError, setNgrokAuthtokenError] = useState<string | null>(null)
    const [localIp, setLocalIp] = useState("localhost")
    const [ipCopied, setIpCopied] = useState(false)
    const [ngrokUrlCopied, setNgrokUrlCopied] = useState(false)

    // Delete dialog
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

    // Helper for tag colors and icons
    const getTagConfig = (tag: string) => {
        const lower = tag.toLowerCase()
        if (lower.includes("fabric")) return { color: "bg-stone-400/10 text-stone-500 dark:text-stone-400 border-stone-400/20 hover:bg-stone-400/15", icon: ScrollText }
        if (lower.includes("forge")) return { color: "bg-indigo-700/10 text-indigo-700 dark:text-indigo-400 border-indigo-700/20 hover:bg-indigo-700/15", icon: Anvil }
        if (lower.includes("neoforge")) return { color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 hover:bg-orange-500/15", icon: Zap }
        if (lower.includes("quilt")) return { color: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15", icon: Layers }
        if (lower.includes("paper")) return { color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/15", icon: Send }
        if (lower.includes("spigot")) return { color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/15", icon: Droplet }
        if (lower.includes("velocity")) return { color: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20 hover:bg-teal-500/15", icon: Wind }
        if (lower.includes("folia")) return { color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-green-500/15", icon: Leaf }
        if (lower.includes("bukkit")) return { color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 hover:bg-orange-500/15", icon: Box }
        if (lower.includes("bungeecord")) return { color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/15", icon: Layers }
        if (lower.includes("waterfall")) return { color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/15", icon: Droplet }
        if (lower.includes("sponge")) return { color: "bg-lime-500/10 text-lime-600 dark:text-lime-400 border-lime-500/20 hover:bg-lime-500/15", icon: Square }
        if (lower.includes("purpur")) return { color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 hover:bg-purple-500/15", icon: Box }
        return { color: "bg-muted text-muted-foreground border-border hover:bg-muted/80", icon: Box }
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

    // Backup state
    const [backups, setBackups] = useState<BackupEntry[]>([])
    const [backupsLoading, setBackupsLoading] = useState(false)
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(false)
    const [backupInterval, setBackupInterval] = useState("24")
    const [createBackupDialogOpen, setCreateBackupDialogOpen] = useState(false)
    const [newBackupName, setNewBackupName] = useState("")
    const [creatingBackup, setCreatingBackup] = useState(false)
    const [backupPercent, setBackupPercent] = useState(0)
    const [backupStage, setBackupStage] = useState<'idle' | 'calculating' | 'archiving' | 'complete'>('idle')
    const [backupFileCount, setBackupFileCount] = useState({ processed: 0, total: 0 })

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
    const [restarting, setRestarting] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    
    // Disk usage state
    const [diskUsage, setDiskUsage] = useState<number | null>(null)
    const [diskUsageLoading, setDiskUsageLoading] = useState(false)

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

                // Backups
                if (s.backupConfig) {
                    setAutoBackupEnabled(s.backupConfig.enabled)
                    setBackupInterval(s.backupConfig.intervalHours.toString())
                }
                
                // Load server properties to get the port
                window.context.getServerProperties(id).then((props) => {
                    setProperties(props)
                    setPropsLoaded(true)
                })
            }
        })
    }, [id])

    // Load system info for RAM limits
    useEffect(() => {
        window.context.getSystemInfo().then((info) => {
            setMaxRamMB(info.maxRamMB)
        })
    }, [])

    // Load disk usage
    useEffect(() => {
        if (!id) return
        setDiskUsageLoading(true)
        window.context.getServerDiskUsage(id).then((result) => {
            if (result.success && result.bytes !== undefined) {
                setDiskUsage(result.bytes)
            }
            setDiskUsageLoading(false)
        })
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

    // Backup progress subscriber - Now receives detailed progress updates
    useEffect(() => {
        if (!id) return
        const unsubscribe = window.context.onBackupProgress(({ serverId, percent, stage, processedFiles, totalFiles }) => {
            if (serverId === id) {
                if (percent < 0) {
                    // Error state
                    setBackupPercent(-1);
                    setCreatingBackup(false);
                    setBackupStage('idle');
                    setError("Backup failed");
                } else {
                    setBackupPercent(percent);
                    setCreatingBackup(true);
                    if (stage) {
                        setBackupStage(stage as 'idle' | 'calculating' | 'archiving' | 'complete');
                    }
                    if (processedFiles !== undefined && totalFiles !== undefined) {
                        setBackupFileCount({ processed: processedFiles, total: totalFiles });
                    }
                }
            }
        })
        return unsubscribe
    }, [id])

    // Backup completion subscriber
    useEffect(() => {
        if (!id) return
        const unsubscribe = window.context.onBackupCompleted(({ serverId }) => {
            if (serverId === id) {
                // Backup completed - refresh the list
                setTimeout(() => {
                    setCreatingBackup(false);
                    setBackupPercent(0);
                    setBackupStage('idle');
                    setBackupFileCount({ processed: 0, total: 0 });
                    loadBackups();
                }, 1000);
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

    // Get local IP on mount
    useEffect(() => {
        window.context.getLocalIp().then(setLocalIp).catch(() => setLocalIp("localhost"))
    }, [])

    // Ngrok URL change subscriber
    useEffect(() => {
        if (!id) return
        const unsubscribe = window.context.onNgrokUrlChanged((info) => {
            if (info.serverId === id) {
                setServer((prev) => prev ? { ...prev, ngrokUrl: info.publicUrl } : prev)
                setNgrokStatus((prev) => prev ? { ...prev, tunnelActive: true, publicUrl: info.publicUrl } : prev)
                // Persist ngrok URL to server record
                window.context.updateServerSettings(id, { ngrokUrl: info.publicUrl })
            }
        })
        return unsubscribe
    }, [id])

    // Ngrok install progress subscriber
    useEffect(() => {
        const unsubscribe = window.context.onNgrokInstallProgress((data) => {
            setNgrokInstallProgress(data.percent)
        })
        return unsubscribe
    }, [])

    // Get ngrok status when server changes
    useEffect(() => {
        if (id) {
            window.context.getNgrokStatus(id).then(setNgrokStatus)
        }
    }, [id])

    const handleStart = async () => {
        if (!id || !server) return
        // Check if EULA needs to be accepted (new servers or servers where it hasn't been accepted)
        // Treat eulaAccepted === undefined as true for backward compatibility with existing servers
        if (server.eulaAccepted === false) {
            setEulaDialogOpen(true)
            return
        }
        // Check if ngrok is enabled globally (not just per-server setting)
        const ngrokEnabled = await window.context.isNgrokEnabled()
        const hasToken = await window.context.isNgrokAuthtokenConfigured()
        
        // Auto-start ngrok if enabled globally and has token
        if (ngrokEnabled && hasToken) {
            await doStartServer(true)
        } else {
            await doStartServer(false)
        }
    }

    const doStartServer = async (withNgrok = false) => {
        if (!id) return
        setStarting(true)
        setError(null)
        const result = await window.context.startServer(id)
        if (!result.success) {
            setError(result.error || "Failed to start server")
        } else if (withNgrok) {
            // Start ngrok tunnel after server starts
            const port = properties.find(p => p.key === "server-port")?.value || "25565"
            const ngrokResult = await window.context.startNgrok(id, parseInt(port, 10))
            if (!ngrokResult.success) {
                setError(ngrokResult.error || "Failed to start ngrok tunnel")
            }
        }
        setStarting(false)
    }

    const handleAcceptEula = async () => {
        if (!id) return
        setEulaDialogOpen(false)
        const result = await window.context.acceptEula(id)
        if (result.success) {
            setServer((prev) => prev ? { ...prev, eulaAccepted: true } : prev)
            
            // Check if ngrok is enabled globally and if we have a saved token
            const ngrokEnabled = await window.context.isNgrokEnabled()
            const hasToken = await window.context.isNgrokAuthtokenConfigured()
            
            if (ngrokEnabled && hasToken) {
                // We have a saved token, use it directly and start server with ngrok
                await doStartServer(true)
            } else {
                // First-time start: ask about ngrok after accepting the EULA
                setNgrokDialogOpen(true)
            }
        } else {
            setError(result.error || "Failed to accept EULA")
        }
    }

    const handleEnableNgrok = async () => {
        if (!id) return
        
        // Validate authtoken
        if (!ngrokAuthtoken.trim()) {
            setNgrokAuthtokenError("Authtoken is required")
            return
        }
        
        setNgrokAuthtokenError(null)
        setNgrokInstallProgress(-2) // Indicate validating phase
        
        // Validate the authtoken first
        const validationResult = await window.context.validateNgrokAuthtoken(ngrokAuthtoken.trim())
        if (!validationResult.valid) {
            setNgrokAuthtokenError(validationResult.error || "Invalid authtoken")
            setNgrokInstallProgress(0)
            return
        }
        
        setNgrokDialogOpen(false)
        setNgrokInstalling(true)
        setNgrokInstallProgress(0)
        
        // Install ngrok
        const installResult = await window.context.installNgrok()
        if (!installResult.success) {
            setError(installResult.error || "Failed to install ngrok")
            setNgrokInstalling(false)
            // Start server without ngrok
            await doStartServer(false)
            return
        }
        
        // Configure authtoken
        setNgrokInstallProgress(-1) // Indicate configuring phase
        const authResult = await window.context.configureNgrokAuthtoken(ngrokAuthtoken.trim())
        if (!authResult.success) {
            setError(authResult.error || "Failed to configure ngrok authtoken")
            setNgrokInstalling(false)
            // Start server without ngrok
            await doStartServer(false)
            return
        }
        
        setNgrokInstalling(false)
        
        // Update server settings to use ngrok
        await window.context.updateServerSettings(id, {
            ramMB: server?.ramMB,
            javaPath: server?.javaPath,
            backupConfig: server?.backupConfig,
            useNgrok: true
        })
        
        // Update local state
        setServer((prev) => prev ? { ...prev, useNgrok: true } : prev)
        
        // Start server with ngrok
        await doStartServer(true)
    }

    const handleSkipNgrok = async () => {
        setNgrokDialogOpen(false)
        await doStartServer(false)
    }

    const handleCopyIP = async () => {
        const port = properties.find(p => p.key === "server-port")?.value || "25565"
        const address = `${localIp}:${port}`
        await navigator.clipboard.writeText(address)
        setIpCopied(true)
        setTimeout(() => setIpCopied(false), 2000)
    }

    const handleCopyNgrokUrl = async () => {
        const url = server?.ngrokUrl || ngrokStatus?.publicUrl
        if (url) {
            await navigator.clipboard.writeText(url)
            setNgrokUrlCopied(true)
            setTimeout(() => setNgrokUrlCopied(false), 2000)
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

    const handleRestart = async () => {
        if (!id) return
        setRestarting(true)
        setError(null)
        
        // Backend handles ngrok checking and starting internally
        const result = await window.context.restartServer(id)
        if (!result.success) {
            setError(result.error || "Failed to restart server")
        }
        setRestarting(false)
    }

    const handleExport = async () => {
        if (!id) return
        setExporting(true)
        setError(null)
        const result = await window.context.exportServer(id)
        if (!result.success && result.error !== "Export cancelled") {
            setError(result.error || "Failed to export server")
        }
        setExporting(false)
    }

    const handleLoadProperties = async () => {
        if (!id) return
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
        if (!id) return
        const wl = await window.context.getWhitelist(id)
        setWhitelist(wl)
        setWhitelistLoaded(true)
    }

    const handleLoadBanlist = async () => {
        if (!id) return
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

    // Automatically load Modrinth results when tab is opened/context is available
    useEffect(() => {
        if (modrinthContext && modrinthResults.length === 0 && !modrinthLoading && modrinthQuery === "") {
            handleSearchModrinth(0)
        }
    }, [modrinthContext])

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
            javaPath: javaPath.trim() || undefined,
            backupConfig: {
                enabled: autoBackupEnabled,
                intervalHours: parseInt(backupInterval),
                lastBackupAt: server?.backupConfig?.lastBackupAt
            }
        })
        setSettingsSaving(false)
        if (result.success) {
            setServer((prev) =>
                prev ? { 
                    ...prev, 
                    ramMB: effectiveRam, 
                    javaPath: javaPath.trim() || undefined,
                    backupConfig: {
                        enabled: autoBackupEnabled,
                        intervalHours: parseInt(backupInterval),
                        lastBackupAt: server?.backupConfig?.lastBackupAt
                    }
                } : prev
            )
            setSettingsSuccess(true)
            setTimeout(() => setSettingsSuccess(false), 3000)
        }
    }

    const loadBackups = async () => {
        if (!id) return
        setBackupsLoading(true)
        const data = await window.context.getBackups(id)
        setBackups(data)
        setBackupsLoading(false)
    }

    const handleCreateBackup = async () => {
        if (!id) return
        window.context.logToMain("handleCreateBackup:start", { id, name: newBackupName })
        setCreatingBackup(true)
        setBackupPercent(0)
        setBackupStage('calculating')
        setBackupFileCount({ processed: 0, total: 0 })
        setCreateBackupDialogOpen(false) // Close dialog to show progress on main button
        
        const backupName = newBackupName.trim() || undefined
        setNewBackupName("")

        try {
            // Fire and forget - backup runs in worker thread
            const result = await window.context.createBackup(id, backupName)
            if (!result.success) {
                window.context.logToMain("handleCreateBackup:error", { id, error: result.error })
                setError(result.error || "Failed to create backup")
                setCreatingBackup(false)
                setBackupStage('idle')
            } else if (result.started) {
                window.context.logToMain("handleCreateBackup:started", { id })
                // UI updates now come from onBackupProgress and onBackupCompleted events
            }
        } catch (err) {
            window.context.logToMain("handleCreateBackup:exception", { id, error: String(err) })
            setError("Failed to initiate backup")
            setCreatingBackup(false)
            setBackupStage('idle')
        }
        // Note: We don't setCreatingBackup(false) here anymore -
        // that happens when we receive the completion event
    }

    const handleCancelBackup = async () => {
        if (!id) return
        try {
            const result = await window.context.cancelBackup(id)
            if (result.success) {
                window.context.logToMain("handleCancelBackup:success", { id })
                setCreatingBackup(false)
                setBackupPercent(0)
                setBackupStage('idle')
                setBackupFileCount({ processed: 0, total: 0 })
            }
        } catch (err) {
            window.context.logToMain("handleCancelBackup:error", { id, error: String(err) })
        }
    }

    const handleDeleteBackup = async (filename: string) => {
        if (!id) return
        const result = await window.context.deleteBackup(id, filename)
        if (result.success) {
            loadBackups()
        } else {
             setError(result.error || "Failed to delete backup")
        }
    }

    const handleRestoreBackup = async (filename: string) => {
        if (!id) return
        const result = await window.context.restoreBackup(id, filename)
        if (result.success) {
            // maybe refresh file list?
             setSettingsSuccess(true)
             setTimeout(() => setSettingsSuccess(false), 3000)
        } else {
             setError(result.error || "Failed to restore backup")
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

    const formatBytes = (bytes: number) => {
        if (bytes >= 1073741824) { // GB
            const gb = bytes / 1073741824
            return gb % 1 === 0 ? `${gb} GB` : `${gb.toFixed(2)} GB`
        }
        if (bytes >= 1048576) { // MB
            const mb = bytes / 1048576
            return mb % 1 === 0 ? `${mb} MB` : `${mb.toFixed(1)} MB`
        }
        if (bytes >= 1024) { // KB
            return `${(bytes / 1024).toFixed(1)} KB`
        }
        return `${bytes} B`
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
        <section className="flex flex-col gap-0 pb-10">
            {/* Header */}
            <header className="px-10 pt-6 pb-5">
                {/* Back link */}
                <button
                    onClick={() => navigate("/servers")}
                    className="text-sm text-primary hover:underline flex items-center gap-1.5 mb-4"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    All servers
                </button>

                {/* Server title row */}
                <div className="flex items-start gap-5">
                    {/* Server icon */}
                    <div className="h-16 w-16 rounded-xl bg-muted/60 border border-border flex items-center justify-center shrink-0 overflow-hidden">
                        <Box className="h-8 w-8 text-muted-foreground" />
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                            <h1 className="text-2xl font-bold tracking-tight">{server.name}</h1>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => id && window.context.openServerFolder(id)}
                                >
                                    <FolderOpen className="h-4 w-4 mr-1" />
                                    Open folder
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleExport}
                                    disabled={exporting}
                                >
                                    {exporting ? <Spinner className="h-4 w-4 mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                                    {exporting ? "Exporting..." : "Export"}
                                </Button>
                                {isOnline ? (
                                    <>
                                        <Button variant="outline" size="sm" onClick={handleRestart} disabled={restarting}>
                                            {restarting ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                                            {restarting ? "Restarting..." : "Restart"}
                                        </Button>
                                        <Button variant="destructive" size="sm" onClick={handleStop} disabled={stopping}>
                                            {stopping ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5 mr-1.5" />}
                                            {stopping ? "Stopping..." : "Stop"}
                                        </Button>
                                    </>
                                ) : (
                                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" size="sm" onClick={handleStart} disabled={starting}>
                                        {starting ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                                        {starting ? "Starting..." : "Start"}
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
                                <Box className="h-3 w-3" />
                                Minecraft {server.version}
                            </Badge>
                            <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
                                <Layers className="h-3 w-3" />
                                {server.framework} {server.version}
                            </Badge>
                            <Badge
                                variant="outline"
                                className="gap-1.5 font-normal text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                                onClick={handleCopyIP}
                            >
                                <Globe className="h-3 w-3" />
                                {ipCopied ? "Copied!" : `${localIp}:${properties.find(p => p.key === "server-port")?.value || "25565"}`}
                            </Badge>
                            {server.status === "Online" && (server.ngrokUrl || ngrokStatus?.publicUrl) && (
                                <Badge
                                    variant="outline"
                                    className="gap-1.5 font-normal text-primary cursor-pointer hover:text-primary/80 transition-colors border-primary/30"
                                    onClick={handleCopyNgrokUrl}
                                >
                                    <Link className="h-3 w-3" />
                                    {ngrokUrlCopied ? "Copied!" : (server.ngrokUrl || ngrokStatus?.publicUrl)}
                                </Badge>
                            )}
                            <Badge variant={isOnline ? "default" : "outline"} className={`gap-1.5 ${isOnline ? "" : "text-muted-foreground"}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-primary-foreground" : "bg-muted-foreground"}`} />
                                {server.status}
                            </Badge>
                        </div>
                    </div>
                </div>
            </header>

            {error && (
                <div className="px-10">
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="overview" className="flex flex-col">
                <div className="px-10 border-b border-border">
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="library">Content</TabsTrigger>
                        <TabsTrigger value="files" onClick={() => handleLoadFiles(currentPath)}>Files</TabsTrigger>
                        <TabsTrigger value="settings" onClick={loadBackups}>Settings</TabsTrigger>
                        <TabsTrigger value="properties" onClick={() => { handleLoadProperties(); handleLoadWhitelist(); handleLoadBanlist(); }}>Properties</TabsTrigger>
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    </TabsList>
                </div>

                {/* Overview Tab */}
                <TabsContent value="overview" className="mt-0 px-10 pt-6">
                    {/* Stats cards */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        {/* Players card */}
                        <Card className="overflow-hidden">
                            <CardContent className="p-5 relative">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <span className="text-3xl font-bold tabular-nums">
                                            {isOnline
                                                ? stats ? `${stats.playerCount}` : "0"
                                                : "—"}
                                        </span>
                                        <span className="text-sm text-muted-foreground ml-1">
                                            / {isOnline && stats ? stats.maxPlayers : "20"}
                                        </span>
                                    </div>
                                    <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center">
                                        <Users className="h-4.5 w-4.5 text-muted-foreground" />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">Players online</p>
                                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                        className="h-full rounded-full bg-primary transition-all duration-500"
                                        style={{ width: isOnline && stats ? `${Math.min(100, (stats.playerCount / stats.maxPlayers) * 100)}%` : "0%" }}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Memory card */}
                        <Card className="overflow-hidden">
                            <CardContent className="p-5 relative">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <span className={`text-3xl font-bold tabular-nums ${isOnline && memoryPercent != null && memoryPercent > 85 ? "text-destructive" : ""}`}>
                                            {isOnline && memoryPercent != null
                                                ? `${memoryPercent}%`
                                                : isOnline ? "..." : "—"}
                                        </span>
                                        <span className="text-sm text-muted-foreground ml-1">
                                            {isOnline && memoryUsed != null ? `${memoryUsed} / ${memoryMax ?? "?"} MB` : formatRam(server.ramMB)}
                                        </span>
                                    </div>
                                    <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center">
                                        <MemoryStick className="h-4.5 w-4.5 text-muted-foreground" />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">Memory usage</p>
                                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${isOnline && memoryPercent != null && memoryPercent > 85 ? "bg-destructive" : "bg-primary"}`}
                                        style={{ width: isOnline && memoryPercent != null ? `${memoryPercent}%` : "0%" }}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Storage card */}
                        <Card className="overflow-hidden">
                            <CardContent className="p-5 relative">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <span className="text-3xl font-bold tabular-nums">
                                            {diskUsage !== null ? formatBytes(diskUsage) : diskUsageLoading ? "..." : "—"}
                                        </span>
                                    </div>
                                    <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center">
                                        <Archive className="h-4.5 w-4.5 text-muted-foreground" />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">Storage usage</p>
                                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
                                    <div className="h-full rounded-full bg-primary/40" style={{ width: "0%" }} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Console — isolated component with its own state */}
                    <ConsoleTab serverId={id || ""} isOnline={isOnline} />
                </TabsContent>

                {/* Properties Tab */}
                <TabsContent value="properties" className="mt-0 px-10 pt-6">
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
                                    className="bg-primary text-primary-foreground hover:bg-primary/90"
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
                                <Alert className="mb-4 border-primary/30 bg-primary/10">
                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                    <AlertTitle className="text-primary">
                                        Saved
                                    </AlertTitle>
                                    <AlertDescription className="text-muted-foreground">
                                        Restart the server for changes to take
                                        effect.
                                    </AlertDescription>
                                </Alert>
                            )}
                            {properties.length === 0 ? (
                                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                    <Info className="h-4 w-4" />
                                    <span>
                                        No server.properties file found. Start
                                        the server once to generate it.
                                    </span>
                                </div>
                            ) : (
                                <div>
                                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                                        <span>Property</span>
                                        <span>Value</span>
                                    </div>
                                    <div className="mt-3 flex flex-col gap-2 max-h-[400px] overflow-auto">
                                        {filteredProperties.map(({ prop, index }) => (
                                            <div
                                                key={`${prop.key}-${index}`}
                                                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 items-center rounded-xl border border-border bg-muted/50 px-3 py-2"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-3 w-3 text-primary" />
                                                    <span className="text-xs text-muted-foreground font-mono truncate">
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
                                            <p className="text-xs text-muted-foreground">No properties match that search.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Players Tab */}
                <TabsContent value="players" className="mt-0 px-10 pt-6">
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
                                    className="bg-primary text-primary-foreground hover:bg-primary/90"
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
                                            className="flex items-center justify-between rounded-lg bg-muted/50 border border-border px-3 py-1.5 text-xs"
                                        >
                                            <span>{player}</span>
                                            <button
                                                className="text-muted-foreground/60 hover:text-rose-400 transition"
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
                                        <p className="text-xs text-muted-foreground">
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
                                    className="bg-primary text-primary-foreground hover:bg-primary/90"
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
                                            className="flex items-center justify-between rounded-lg bg-muted/50 border border-border px-3 py-1.5 text-xs"
                                        >
                                            <span>{player}</span>
                                            <button
                                                className="text-muted-foreground/60 hover:text-rose-400 transition"
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
                                        <p className="text-xs text-muted-foreground">
                                            No players banned
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Library Tab */}
                <TabsContent value="library" className="mt-0 px-10 pt-6 max-h-[740px] overflow-auto pr-1">
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
                                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                                            onClick={() => handleSearchModrinth()}
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
                                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                            <Info className="h-4 w-4" />
                                            <span>Run a search to see results.</span>
                                        </div>
                                    ) : (
                                        <div className="max-h-[600px] overflow-auto pr-2 custom-scrollbar">
                                            <div className="flex flex-col gap-3">
                                                {modrinthResults.map((hit) => (
                                                <div
                                                    key={hit.projectId}
                                                    className="group relative flex flex-row w-full items-stretch gap-4 rounded-xl border border-border bg-card p-3 transition-all hover:border-border hover:bg-muted/50 cursor-pointer"
                                                    onClick={() => handleOpenModrinthDetails(hit)}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") handleOpenModrinthDetails(hit)
                                                    }}
                                                >
                                                    {/* Left: Icon Frame */}
                                                    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-muted p-2 border border-border/50 overflow-hidden">
                                                         <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-muted-foreground/20 z-0 select-none">
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
                                                                <h3 className="text-base font-bold text-foreground underline decoration-muted-foreground/30 underline-offset-4 truncate">{hit.title}</h3>
                                                                <span className="text-xs text-muted-foreground truncate">by {hit.author}</span>
                                                            </div>
                                                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground leading-snug">
                                                                {hit.description}
                                                            </p>
                                                        </div>
                                                        
                                                        {/* Tags */}
                                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                                            {/* Client/Server Tag */}
                                                            {(hit.clientSide !== 'unsupported' || hit.serverSide !== 'unsupported') && (
                                                                <Badge variant="outline" className="flex items-center gap-1.5 border-border bg-muted text-muted-foreground hover:bg-muted/80 px-2 py-0.5 font-normal">
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
                                                                                        <Badge variant="outline" className="flex items-center gap-1 border-border bg-muted text-muted-foreground hover:bg-muted/80 px-2 py-0.5 font-normal cursor-help">
                                                                                            <Plus className="h-3 w-3" />
                                                                                            <span>{overflow.length}</span>
                                                                                        </Badge>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent side="bottom" className="bg-card border border-border p-2">
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
                                                        <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
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
                                                                <Button size="sm" className="h-7 text-xs bg-primary/15 text-primary hover:bg-primary/15 cursor-default" disabled>
                                                                    Installed
                                                                </Button>
                                                            ) : modrinthInstalling[hit.projectId] ? (
                                                                <Button size="sm" variant="outline" className="h-7 text-xs" disabled>
                                                                    <Spinner className="mr-1.5 h-3 w-3" />
                                                                    Downloading
                                                                </Button>
                                                            ) : (
                                                                <Button size="sm" className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => handleInstallModrinth(hit)}>
                                                                    <Download className="h-3.5 w-3.5 mr-1.5" />
                                                                    Install
                                                                </Button>
                                                            )}
                                                        </div>

                                                        {/* Bottom Right: Timestamp */}
                                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
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
                                        <div className="flex items-center justify-between pt-4 pb-2 text-xs text-muted-foreground">
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
                                                    className="border-border text-foreground hover:bg-secondary h-8"
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
                                                    className="border-border text-foreground hover:bg-secondary h-8"
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
                                        <CardTitle>Installed {modrinthContext.label}</CardTitle>
                                        <CardDescription className="text-muted-foreground">
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
                                            <Spinner className="text-primary" />
                                        </div>
                                    ) : modrinthInstalls.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">Nothing installed yet.</p>
                                    ) : (
                                        <div className="flex flex-col gap-2 max-h-[420px] overflow-auto pr-1">
                                            {modrinthInstalls.map((entry) => (
                                                <div
                                                    key={entry.projectId}
                                                    className="flex items-center justify-between rounded-xl border border-border bg-muted/50 px-3 py-3"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="relative h-10 w-10 shrink-0">
                                                            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
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
                                                            <p className="text-[10px] text-muted-foreground/60 truncate">
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
                <TabsContent value="files" className="mt-0 px-10 pt-6">
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
                                        className="text-primary hover:underline"
                                        onClick={() => handleLoadFiles("")}
                                    >
                                        root
                                    </button>
                                    {pathSegments.map((segment, i) => (
                                        <span key={i} className="flex items-center gap-1">
                                            <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                                            <button
                                                className="text-primary hover:underline"
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
                                        <Spinner className="text-primary" />
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1 max-h-[520px] overflow-auto">
                                        {/* Go up (..) */}
                                        {currentPath && (
                                            <button
                                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-muted/50"
                                                onClick={handleNavigateUp}
                                            >
                                                <Folder className="h-4 w-4 text-primary" />
                                                <span className="text-sm text-muted-foreground">..</span>
                                            </button>
                                        )}
                                        {files.map((entry) => {
                                            const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name
                                            const isSelected = selectedFilePath === entryPath
                                            return (
                                                <button
                                                    key={entry.name}
                                                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-muted/50 ${
                                                        isSelected ? "bg-primary/10 border border-primary/30" : ""
                                                    }`}
                                                    onClick={() => handleNavigateFile(entry)}
                                                    onContextMenu={(e) => onContextMenu(e, entry)}
                                                    style={{
                                                        cursor: entry.isDirectory ? "pointer" : "default",
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {entry.isDirectory ? (
                                                            <Folder className="h-4 w-4 text-primary" />
                                                        ) : (
                                                            <File className="h-4 w-4 text-muted-foreground/60" />
                                                        )}
                                                        <span className="text-sm">
                                                            {entry.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-muted-foreground/60">
                                                        <span>{entry.isDirectory ? "" : formatFileSize(entry.size)}</span>
                                                        <span className="w-[100px] text-right">
                                                            {new Date(entry.modifiedAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                        {files.length === 0 && !currentPath && (
                                            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground text-sm">
                                                <Info className="h-4 w-4" />
                                                <span>No files yet. Start the server once to generate files.</span>
                                            </div>
                                        )}
                                        {files.length === 0 && currentPath && (
                                            <p className="text-xs text-muted-foreground text-center py-8">
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
                                        className="bg-primary text-primary-foreground hover:bg-primary/90"
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
                                    <Alert className="mb-4 border-destructive/30 bg-destructive/10">
                                        <AlertTitle className="text-destructive">Editor error</AlertTitle>
                                        <AlertDescription className="text-destructive/80">
                                            {fileError}
                                        </AlertDescription>
                                    </Alert>
                                )}
                                {!selectedFilePath ? (
                                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
                                        <FileText className="h-5 w-5" />
                                        <span>Select a file to start editing</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span className="truncate">{selectedFilePath}</span>
                                            {selectedFileMeta && (
                                                <span>
                                                    {formatFileSize(selectedFileMeta.size)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="rounded-xl border border-border bg-[#2c2b28]">
                                            {fileLoading ? (
                                                <div className="flex items-center justify-center py-16">
                                                    <Spinner className="text-primary" />
                                                </div>
                                            ) : (
                                                <textarea
                                                    value={fileContent}
                                                    onChange={(e) => {
                                                        setFileContent(e.target.value)
                                                        setFileDirty(true)
                                                    }}
                                                    spellCheck={false}
                                                    className="h-[360px] w-full resize-none bg-transparent p-3 text-xs font-mono text-foreground/90 outline-none select-text"
                                                />
                                            )}
                                        </div>
                                        {fileDirty && (
                                            <div className="text-[11px] text-primary">
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
                            className="fixed z-50 min-w-[160px] rounded-lg border border-border bg-card p-1 shadow-xl animate-in fade-in zoom-in-95"
                            style={{ top: contextMenu.y, left: contextMenu.x }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button onClick={() => { if(contextMenu.entry.isDirectory) { handleLoadFiles(currentPath ? `${currentPath}/${contextMenu.entry.name}` : contextMenu.entry.name) } else { handleOpenFile(currentPath ? `${currentPath}/${contextMenu.entry.name}` : contextMenu.entry.name, contextMenu.entry) } setContextMenu(null) }} className="w-full text-left px-2 py-1.5 text-xs text-foreground hover:bg-muted/50 rounded-md">Open</button>
                            <button onClick={handleRenameClick} className="w-full text-left px-2 py-1.5 text-xs text-foreground hover:bg-muted/50 rounded-md">Rename</button>
                            <button onClick={handleDuplicateClick} className="w-full text-left px-2 py-1.5 text-xs text-foreground hover:bg-muted/50 rounded-md">Duplicate</button>
                            <div className="h-[1px] bg-muted/50 my-1" />
                            <button onClick={handleDeleteClick} className="w-full text-left px-2 py-1.5 text-xs text-destructive hover:bg-muted/50 rounded-md">Delete</button>
                        </div>
                    )}

                    <Dialog open={fileRenameDialogOpen} onOpenChange={setFileRenameDialogOpen}>
                        <DialogContent className="bg-card border-border">
                            <DialogHeader>
                                <DialogTitle>Rename File</DialogTitle>
                                <DialogDescription>Enter a new name for the file.</DialogDescription>
                            </DialogHeader>
                            <Input 
                                value={fileActionInput} 
                                onChange={(e) => setFileActionInput(e.target.value)} 
                                className="border-border font-mono" 
                            />
                            <div className="flex justify-end gap-2 mt-4">
                                <Button variant="ghost" onClick={() => setFileRenameDialogOpen(false)}>Cancel</Button>
                                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={confirmRename}>Rename</Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={fileDuplicateDialogOpen} onOpenChange={setFileDuplicateDialogOpen}>
                        <DialogContent className="bg-card border-border">
                            <DialogHeader>
                                <DialogTitle>Duplicate File</DialogTitle>
                                <DialogDescription>Enter a name for the copy.</DialogDescription>
                            </DialogHeader>
                            <Input 
                                value={fileActionInput} 
                                onChange={(e) => setFileActionInput(e.target.value)} 
                                className="border-border font-mono" 
                            />
                            <div className="flex justify-end gap-2 mt-4">
                                <Button variant="ghost" onClick={() => setFileDuplicateDialogOpen(false)}>Cancel</Button>
                                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={confirmDuplicate}>Duplicate</Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <AlertDialog open={fileDeleteDialogOpen} onOpenChange={setFileDeleteDialogOpen}>
                        <AlertDialogContent className="bg-card border-border">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete 
                                    <span className="text-primary font-mono mx-1">{targetEntry?.name}</span>.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="border-border bg-muted/50 text-foreground hover:bg-muted/50 hover:text-foreground">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </TabsContent>



                {/* Backups Tab - MOVED TO SETTINGS */}
                
                {/* Create Backup Dialog */}
                 <Dialog open={createBackupDialogOpen} onOpenChange={setCreateBackupDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Backup</DialogTitle>
                            <DialogDescription>
                                Enter a name for this backup.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <label htmlFor="name" className="text-sm font-medium">Backup Name (Optional)</label>
                                <Input 
                                    id="name" 
                                    value={newBackupName} 
                                    onChange={(e) => setNewBackupName(e.target.value)} 
                                    placeholder="e.g. Before Mod Update" 
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setCreateBackupDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreateBackup} disabled={creatingBackup} className="bg-primary hover:bg-primary/90">
                                {creatingBackup && <Spinner className="mr-2" />}
                                Create
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Settings Tab */}
                <TabsContent value="settings" className="mt-0 px-10 pt-6 space-y-8 pb-10 max-h-[75vh] overflow-y-auto pr-2">
                    
                    {/* Fixed Success Alert */}
                    {settingsSuccess && (
                        <div className="fixed bottom-6 right-6 z-50 w-[380px] animate-in slide-in-from-bottom-5 fade-in duration-300">
                             <Alert className="border-primary/40 bg-primary/10 text-primary shadow-xl">
                                <CheckCircle2 className="h-4 w-4" />
                                <AlertTitle>Success</AlertTitle>
                                <AlertDescription>
                                    {isOnline
                                        ? "Settings saved. RAM changes will apply on next server restart."
                                        : "Settings saved. RAM changes will apply on next server start."}
                                </AlertDescription>
                                <AlertAction>
                                    <Button variant="ghost" size="icon" className="-mt-2 -mr-2 h-8 w-8 text-primary/60 hover:text-primary" onClick={() => setSettingsSuccess(false)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </AlertAction>
                             </Alert>
                        </div>
                    )}

                    {/* Section: General */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                            <Info className="h-5 w-5 text-primary" />
                            <h3 className="text-lg font-semibold tracking-tight">General Information</h3>
                        </div>
                        <div className="grid gap-4 xl:grid-cols-2">
                             <Card>
                                <CardHeader>
                                    <CardTitle>Server Details</CardTitle>
                                    <CardDescription>
                                        Quick reference and tools
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-4">
                                    <div className="grid gap-2 text-sm">
                                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                            <span className="text-muted-foreground">Platform</span>
                                            <span className="font-medium flex items-center gap-2">
                                                {server.framework}
                                                <Badge variant="outline" className="text-[10px] py-0 h-5 bg-muted">{server.version}</Badge>
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                            <span className="text-muted-foreground">Created</span>
                                            <span className="font-medium">
                                                {new Date(server.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                            <span className="text-muted-foreground">Path</span>
                                            <span className="font-medium truncate max-w-[200px] text-right text-xs font-mono opacity-80" title={server.serverPath}>
                                                {server.serverPath}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                            <span className="text-muted-foreground">Disk Usage</span>
                                            <span className="font-medium flex items-center gap-2">
                                                {diskUsageLoading ? (
                                                    <Spinner className="h-3.5 w-3.5" />
                                                ) : diskUsage !== null ? (
                                                    formatBytes(diskUsage)
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 border-border hover:bg-muted/50"
                                            onClick={() => id && window.context.openServerFolder(id)}
                                        >
                                            <FolderOpen className="h-4 w-4 mr-2" />
                                            Folder
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 border-border hover:bg-muted/50"
                                            onClick={() => handleLoadFiles(currentPath)}
                                        >
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Refresh
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Section: Performance */}
                    <div className="space-y-4">
                         <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                            <Gauge className="h-5 w-5 text-primary" />
                            <h3 className="text-lg font-semibold tracking-tight">Performance</h3>
                        </div>
                        <div className="grid gap-4 xl:grid-cols-2">
                             <Card>
                                <CardHeader>
                                    <CardTitle>Java & Memory</CardTitle>
                                    <CardDescription>
                                        Changes require a server restart to take effect
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-6">
                                    <div className="grid gap-3">
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                                Allocated Memory (RAM)
                                            </label>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="h-3.5 w-3.5 text-muted-foreground/40 cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right" className="max-w-xs">
                                                        <p className="text-xs">
                                                            This sets the Java heap size (-Xmx). The actual process memory will be ~10-20% higher due to JVM overhead (metaspace, code cache, thread stacks).
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        <div className="flex gap-4 items-start">
                                            <Select
                                                value={ramOption}
                                                onValueChange={setRamOption}
                                            >
                                                <SelectTrigger className="w-[180px]">
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
                                                <div className="flex-1 flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        min={512}
                                                        max={maxRamMB}
                                                        value={customRamMB}
                                                        onChange={(e) =>
                                                            setCustomRamMB(e.target.value)
                                                        }
                                                        placeholder="MB"
                                                    />
                                                    <span className="text-xs text-muted-foreground">MB (max {maxRamMB})</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid gap-3">
                                        <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                            Java Executable
                                        </label>
                                        <Input
                                            placeholder="System default (java)"
                                            value={javaPath}
                                            onChange={(e) => setJavaPath(e.target.value)}
                                            className="font-mono text-xs"
                                        />
                                    </div>
                                    <Button
                                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                                        onClick={handleSaveSettings}
                                        disabled={settingsSaving}
                                    >
                                        {settingsSaving ? (
                                            <Spinner className="mr-2" />
                                        ) : (
                                            <Save className="h-4 w-4 mr-1" />
                                        )}
                                        Save Performance Settings
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                
                    {/* Section: Backups */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                            <Archive className="h-5 w-5 text-amber-500" />
                            <h3 className="text-lg font-semibold tracking-tight">Backups</h3>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                             {/* Backup Config */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Configuration</CardTitle>
                                    <CardDescription>Automated backup schedule</CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-4">
                                     <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                                        <div className="space-y-0.5">
                                            <div className="text-sm font-medium">Automatic Backups</div>
                                            <div className="text-xs text-muted-foreground">{autoBackupEnabled ? "Active" : "Paused"}</div>
                                        </div>
                                        <Select 
                                            value={autoBackupEnabled ? "on" : "off"} 
                                            onValueChange={(v) => setAutoBackupEnabled(v === "on")}
                                        >
                                            <SelectTrigger className="w-[100px] h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="off">Off</SelectItem>
                                                <SelectItem value="on">On</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {autoBackupEnabled && (
                                        <div className="grid gap-2">
                                            <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                                Interval
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={168}
                                                    value={backupInterval}
                                                    onChange={(e) => setBackupInterval(e.target.value)}
                                                    className="w-24"
                                                />
                                                <span className="text-sm text-muted-foreground">Hours</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="pt-2">
                                        <Button
                                            className="w-full bg-muted/50 text-foreground hover:bg-muted"
                                            onClick={handleSaveSettings}
                                            disabled={settingsSaving}
                                            variant="outline"
                                        >
                                            {settingsSaving ? <Spinner className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                            Save Backup Config
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Manual Action */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Manual Backup</CardTitle>
                                    <CardDescription>Create a snapshot now</CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col justify-center gap-4">
                                    {/* Work in Progress Warning */}
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
                                        <div className="flex items-start gap-2">
                                            <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                            <div className="text-sm">
                                                <span className="font-semibold text-amber-800">Work in Progress:</span>
                                                <span className="text-amber-700/80 ml-1">Backup functionality is currently under development and may not work correctly.</span>
                                            </div>
                                        </div>
                                    </div>
                                    {creatingBackup ? (
                                        <div className="space-y-3">
                                            {/* Progress Bar */}
                                            <div className="w-full bg-muted rounded-full h-2.5">
                                                <div
                                                    className="bg-amber-500 h-2.5 rounded-full transition-all duration-300"
                                                    style={{ width: `${Math.max(0, backupPercent)}%` }}
                                                ></div>
                                            </div>
                                            
                                            {/* Status Text */}
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Spinner className="h-4 w-4" />
                                                    <span className="text-foreground/80">
                                                        {backupStage === 'calculating' && "Calculating..."}
                                                        {backupStage === 'archiving' && `Archiving ${backupFileCount.total > 0 ? `(${backupFileCount.processed}/${backupFileCount.total})` : ''}`}
                                                        {backupStage === 'complete' && "Finalizing..."}
                                                        {!backupStage && "Creating Backup..."}
                                                    </span>
                                                </div>
                                                <span className="text-muted-foreground font-mono">
                                                    {backupPercent}%
                                                </span>
                                            </div>
                                            
                                            {/* Cancel Button */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full h-8 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                onClick={handleCancelBackup}
                                            >
                                                <X className="h-3 w-3 mr-1" />
                                                Cancel Backup
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button
                                            className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white"
                                            onClick={() => setCreateBackupDialogOpen(true)}
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            New Backup
                                        </Button>
                                    )}
                                    <div className="text-xs text-center text-muted-foreground/60">
                                        Backups are stored in <code>/backups</code> folder
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        
                        {/* List */}
                        <Card>
                             <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div>
                                    <CardTitle>History</CardTitle>
                                    <CardDescription>
                                        {backups.length} snapshot{backups.length !== 1 ? 's' : ''} available
                                    </CardDescription>
                                </div>
                                <Button variant="ghost" size="icon" onClick={loadBackups} disabled={backupsLoading}>
                                    <RefreshCw className={`h-4 w-4 ${backupsLoading ? "animate-spin" : ""}`} />
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {backupsLoading && backups.length === 0 ? (
                                    <div className="flex justify-center py-8">
                                        <Spinner />
                                    </div>
                                ) : backups.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2 bg-muted/50 rounded-lg border border-dashed border-border mx-1">
                                        <Archive className="h-6 w-6 opacity-20" />
                                        <p className="text-xs">No backups found</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2 max-h-[300px] overflow-auto pr-2 custom-scrollbar">
                                        {backups.map((backup) => (
                                            <div key={backup.filename} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border group hover:border-border transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-8 w-8 rounded-md flex items-center justify-center ${backup.type === 'auto' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                                        {backup.type === 'auto' ? <Clock className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium">{backup.name}</div>
                                                        <div className="text-[10px] text-muted-foreground flex gap-3">
                                                            <span>{new Date(backup.createdAt).toLocaleString()}</span>
                                                            <span className="opacity-30">•</span>
                                                            <span>{formatFileSize(backup.size)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRestoreBackup(backup.filename)}>
                                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Restore</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteBackup(backup.filename)}>
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Delete</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Section: Danger Zone */}
                    <div className="space-y-4 pt-4 border-t border-border/50">
                        <div className="flex items-center gap-2 pb-2">
                             <h3 className="text-lg font-semibold tracking-tight text-destructive">Danger Zone</h3>
                        </div>
                        <Card className="border-destructive/20 bg-destructive/5">
                            <CardContent className="flex items-center justify-between p-6">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-medium text-foreground">Delete Server</h4>
                                    <p className="text-xs text-muted-foreground max-w-[400px]">
                                        This action will permanently delete this server and all associated files, logs, and backups. This action cannot be undone.
                                    </p>
                                </div>
                                <Button
                                    variant="destructive"
                                    onClick={() => setDeleteDialogOpen(true)}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Server
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Analytics Tab */}
                <TabsContent value="analytics" className="mt-0 px-10 pt-6 max-h-[75vh] overflow-y-auto pr-2">
                    <AnalyticsTab serverId={id || ""} />
                </TabsContent>
            </Tabs>

            <Dialog open={modrinthDetailOpen} onOpenChange={setModrinthDetailOpen}>
                <DialogContent className="max-w-[800px] border-border bg-card max-h-[85vh] overflow-y-auto custom-scrollbar">
                    <DialogHeader>
                        <DialogTitle>Modrinth Overview</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
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
                                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-muted text-2xl font-bold text-muted-foreground/20 border border-border/50">
                                        {modrinthDetail.title.charAt(0).toUpperCase()}
                                    </div>
                                    {modrinthDetail.iconUrl && (
                                        <img
                                            src={modrinthDetail.iconUrl}
                                            alt={modrinthDetail.title}
                                            className="relative h-20 w-20 rounded-2xl object-contain bg-muted border border-border/50"
                                            onError={(e) => {
                                                e.currentTarget.style.opacity = "0"
                                            }}
                                        />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-2xl font-bold text-foreground truncate">
                                        {modrinthDetail.title}
                                    </h2>
                                    <p className="text-base text-muted-foreground mt-1">
                                        {modrinthDetail.description}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                        <Badge variant="secondary" className="bg-muted/50 hover:bg-muted/50 text-muted-foreground font-normal">
                                            <Download className="w-3 h-3 mr-1" />
                                            {modrinthDetail.downloads.toLocaleString()} downloads
                                        </Badge>
                                        <Badge variant="secondary" className="bg-muted/50 hover:bg-muted/50 text-muted-foreground font-normal">
                                            <Heart className="w-3 h-3 mr-1" />
                                            {modrinthDetail.followers.toLocaleString()} followers
                                        </Badge>
                                        {modrinthDetail.categories?.slice(0, 4).map((category) => (
                                            <Badge
                                                key={category}
                                                variant="outline"
                                                className="border-border text-muted-foreground font-normal capitalize"
                                            >
                                                {category}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 shrink-0">
                                     {installedProjectIds.has(modrinthDetail.projectId) ? (
                                        <Button
                                            className="bg-primary/15 text-primary hover:bg-primary/15 cursor-default w-full"
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
                                            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
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
                                            className="w-full justify-start text-muted-foreground hover:text-foreground"
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
                                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Gallery</h3>
                                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
                                        {modrinthDetail.gallery.map((image) => (
                                            <img
                                                key={image.url}
                                                src={image.url}
                                                alt={image.title || modrinthDetail.title}
                                                className="h-48 rounded-lg object-cover border border-border bg-muted snap-start"
                                                loading="lazy"
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">About</h3>
                                <div className="rounded-xl border border-border bg-card p-6 text-sm text-foreground/80 leading-relaxed font-sans prose max-w-none">
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
                <AlertDialogContent className="border-border bg-card">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Minecraft EULA</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            By starting this server, you agree to the{" "}
                            <a
                                href="https://aka.ms/MinecraftEULA"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline hover:text-primary"
                            >
                                Minecraft End User License Agreement
                            </a>
                            . You must accept the EULA before the server can start.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-border bg-muted/50 text-muted-foreground hover:bg-muted/50">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={handleAcceptEula}
                        >
                            Accept & Start
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Ngrok Dialog */}
            <AlertDialog open={ngrokDialogOpen} onOpenChange={setNgrokDialogOpen}>
                <AlertDialogContent className="border-border bg-card max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Globe className="h-5 w-5 text-primary" />
                            Enable External Access?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            Would you like to use ngrok to allow players from outside your network to join this server?
                            This will automatically download and install ngrok, then create a public tunnel to your server.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-3 py-4">
                        <label className="text-sm font-medium text-foreground/80">
                            Ngrok Authtoken <span className="text-destructive">*</span>
                        </label>
                        <Input
                            type="password"
                            placeholder="Enter your ngrok authtoken"
                            value={ngrokAuthtoken}
                            onChange={(e) => {
                                setNgrokAuthtoken(e.target.value)
                                setNgrokAuthtokenError(null)
                            }}
                            className="bg-muted/50 border-border placeholder:text-muted-foreground/40"
                        />
                        {ngrokAuthtokenError && (
                            <p className="text-sm text-destructive">{ngrokAuthtokenError}</p>
                        )}
                        <p className="text-xs text-muted-foreground/60">
                            Get your free authtoken at{" "}
                            <a
                                href="https://dashboard.ngrok.com/get-started/your-authtoken"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                                onClick={(e) => {
                                    e.preventDefault()
                                    window.context.openExternal("https://dashboard.ngrok.com/get-started/your-authtoken")
                                }}
                            >
                                dashboard.ngrok.com
                            </a>
                        </p>
                    </div>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                        <AlertDialogCancel
                            className="border-border bg-muted/50 text-muted-foreground hover:bg-muted/50"
                            onClick={handleSkipNgrok}
                        >
                            No, local only
                        </AlertDialogCancel>
                        <Button
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={(e) => {
                                e.preventDefault()
                                handleEnableNgrok()
                            }}
                            disabled={ngrokInstallProgress === -2}
                        >
                            {ngrokInstallProgress === -2 ? (
                                <span className="flex items-center gap-2">
                                    <Spinner className="h-4 w-4" />
                                    Validating...
                                </span>
                            ) : (
                                "Yes, enable ngrok"
                            )}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Ngrok Installing Dialog */}
            <AlertDialog open={ngrokInstalling}>
                <AlertDialogContent className="border-border bg-card">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Spinner className="h-5 w-5" />
                            {ngrokInstallProgress < 0 ? "Configuring ngrok..." : "Installing ngrok..."}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            <div className="mt-4">
                                {ngrokInstallProgress < 0 ? (
                                    <p className="text-center text-sm">Setting up your authtoken...</p>
                                ) : (
                                    <>
                                        <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
                                            <div
                                                className="h-full bg-primary rounded-full transition-all duration-300"
                                                style={{ width: `${ngrokInstallProgress}%` }}
                                            />
                                        </div>
                                        <p className="text-center mt-2 text-sm">{ngrokInstallProgress}%</p>
                                    </>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent className="border-border bg-card">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete server "{server.name}"?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            This action cannot be undone. The server folder and all data
                            will be permanently removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-border bg-muted/50 text-muted-foreground hover:bg-muted/50">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

