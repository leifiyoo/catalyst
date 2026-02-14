import { useState, useEffect, useCallback, useRef } from "react"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Users,
    Clock,
    Gauge,
    MemoryStick,
    Globe,
    Skull,
    Sword,
    MessageSquare,
    Terminal,
    RefreshCw,
    TrendingUp,
    Activity,
    ServerOff,
    BarChart3,
    Timer,
    Monitor,
    Cpu,
    Gamepad2,
    Settings,
} from "lucide-react"
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    Cell,
    PieChart,
    Pie,
    Legend,
} from "recharts"
import type { AnalyticsData } from "@shared/types"

interface AnalyticsTabProps {
    serverId: string
}

const POLL_INTERVAL = 7000

const CHART_COLORS = [
    "hsl(var(--primary))",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#ec4899",
    "#84cc16",
    "#f97316",
    "#6366f1",
]

const PIE_COLORS = [
    "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
    "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#3b82f6",
]

const tooltipStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
}

/**
 * Analytics tab component — reads data directly from the filesystem.
 * No API, no connect button, no configuration needed.
 */
export function AnalyticsTab({ serverId }: AnalyticsTabProps) {
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [noData, setNoData] = useState(false)
    const [serverOffline, setServerOffline] = useState(false)
    const [lastUpdated, setLastUpdated] = useState<string | null>(null)
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const lastDataRef = useRef<AnalyticsData | null>(null)

    const loadData = useCallback(async () => {
        try {
            const result = await window.context.getAnalyticsData(serverId)
            if (result.success && result.data) {
                setData(result.data)
                lastDataRef.current = result.data
                setNoData(false)
                setServerOffline(false)
                setLastUpdated(result.data.lastUpdated)
            } else if (result.error === "no-data") {
                if (lastDataRef.current) {
                    setServerOffline(true)
                } else {
                    setNoData(true)
                }
            }
        } catch {
            if (lastDataRef.current) {
                setServerOffline(true)
            }
        } finally {
            setLoading(false)
        }
    }, [serverId])

    useEffect(() => {
        setLoading(true)
        setData(null)
        setNoData(false)
        setServerOffline(false)
        lastDataRef.current = null
        loadData()

        pollRef.current = setInterval(loadData, POLL_INTERVAL)
        return () => {
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [serverId, loadData])

    const formatPlayTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        if (hours > 0) return `${hours}h ${minutes}m`
        return `${minutes}m`
    }

    const formatTimestamp = (ts: string) => {
        try {
            const d = new Date(ts)
            return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        } catch {
            return ts
        }
    }

    const formatUptime = (startTime?: string) => {
        if (!startTime) return "N/A"
        try {
            const start = new Date(startTime).getTime()
            const now = Date.now()
            const diff = Math.floor((now - start) / 1000)
            const hours = Math.floor(diff / 3600)
            const minutes = Math.floor((diff % 3600) / 60)
            if (hours > 24) {
                const days = Math.floor(hours / 24)
                return `${days}d ${hours % 24}h ${minutes}m`
            }
            if (hours > 0) return `${hours}h ${minutes}m`
            return `${minutes}m`
        } catch {
            return "N/A"
        }
    }

    // Loading state
    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Spinner className="text-primary h-6 w-6" />
                <span className="text-muted-foreground text-sm">Loading analytics...</span>
            </div>
        )
    }

    // No data yet
    if (noData && !data) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="rounded-full bg-muted p-4">
                    <BarChart3 className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">Waiting for analytics data...</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                        Start your server to begin collecting analytics. The CatalystAnalytics
                        plugin will automatically gather statistics and display them here.
                    </p>
                </div>
            </div>
        )
    }

    const displayData = data || lastDataRef.current
    if (!displayData) return null

    const { overview, players, tps, memory, timeline, geo, versions, clients, operatingSystems, trackingSettings } = displayData

    // Prepare hourly joins chart data
    const hourlyData = overview?.hourlyJoins
        ? Object.entries(overview.hourlyJoins)
              .map(([hour, count]) => ({
                  hour: `${hour.padStart(2, "0")}:00`,
                  joins: count,
              }))
              .sort((a, b) => a.hour.localeCompare(b.hour))
        : []

    // Prepare MSPT data from TPS
    const msptData = tps
        .filter((t) => t.mspt !== undefined && t.mspt !== null)
        .map((t) => ({
            timestamp: t.timestamp,
            mspt: t.mspt,
        }))

    return (
        <div className="space-y-4 pb-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Server Analytics</h3>
                    {serverOffline && (
                        <Badge variant="secondary" className="gap-1 text-amber-500 border-amber-500/20 bg-amber-500/10">
                            <ServerOff className="h-3 w-3" />
                            Server Offline
                        </Badge>
                    )}
                    {!serverOffline && data && (
                        <Badge variant="secondary" className="gap-1 text-green-500 border-green-500/20 bg-green-500/10">
                            <Activity className="h-3 w-3" />
                            Live
                        </Badge>
                    )}
                </div>
                {lastUpdated && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        Updated {formatTimestamp(lastUpdated)}
                    </span>
                )}
            </div>

            {/* Tabbed sections */}
            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview" className="gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="performance" className="gap-1.5">
                        <Cpu className="h-3.5 w-3.5" />
                        Performance
                    </TabsTrigger>
                    <TabsTrigger value="players" className="gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        Players
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="gap-1.5">
                        <Settings className="h-3.5 w-3.5" />
                        Settings
                    </TabsTrigger>
                </TabsList>

                {/* ===== OVERVIEW TAB ===== */}
                <TabsContent value="overview" className="space-y-4 mt-4">
                    {/* Key Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard icon={Users} label="Online" value={overview.currentOnline} accent="text-green-500" />
                        <StatCard icon={TrendingUp} label="Peak Online" value={overview.peakOnline} accent="text-blue-500" />
                        <StatCard icon={Users} label="Unique Players" value={overview.uniquePlayers} accent="text-purple-500" />
                        <StatCard icon={Timer} label="Uptime" value={formatUptime(overview.serverStartTime)} accent="text-teal-500" />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard icon={Clock} label="Avg Play Time" value={formatPlayTime(overview.averagePlayTimeSeconds)} accent="text-amber-500" />
                        <StatCard icon={Skull} label="Deaths" value={overview.totalDeaths} accent="text-red-500" />
                        <StatCard icon={Sword} label="Kills" value={overview.totalKills} accent="text-orange-500" />
                        <StatCard icon={MessageSquare} label="Chat Messages" value={overview.totalChatMessages} accent="text-indigo-500" />
                    </div>

                    {/* Player Count Timeline + Peak Hours */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {timeline.length > 0 && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium">Player Count Over Time</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <AreaChart data={timeline}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                            <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                            <Tooltip labelFormatter={formatTimestamp} contentStyle={tooltipStyle} />
                                            <Area type="monotone" dataKey="players" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}

                        {hourlyData.length > 0 && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium">Most Active Hours (UTC)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={hourlyData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                            <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                            <Tooltip contentStyle={tooltipStyle} />
                                            <Bar dataKey="joins" name="Joins" radius={[4, 4, 0, 0]}>
                                                {hourlyData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill="hsl(var(--primary))" fillOpacity={0.7} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Activity Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard icon={Terminal} label="Commands" value={overview.totalCommandsExecuted} accent="text-slate-500" />
                        <StatCard icon={TrendingUp} label="Total Joins" value={overview.totalJoins} accent="text-cyan-500" />
                        <StatCard icon={Users} label="New Players" value={overview.newPlayers} accent="text-emerald-500" />
                        <StatCard icon={Users} label="Returning" value={overview.returningPlayers} accent="text-violet-500" />
                    </div>
                </TabsContent>

                {/* ===== PERFORMANCE TAB ===== */}
                <TabsContent value="performance" className="space-y-4 mt-4">
                    {/* Performance Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard
                            icon={Gauge}
                            label="Current TPS"
                            value={overview.currentTps?.toFixed(1) ?? "N/A"}
                            accent={overview.currentTps && overview.currentTps >= 19 ? "text-green-500" : overview.currentTps && overview.currentTps >= 15 ? "text-amber-500" : "text-red-500"}
                        />
                        <StatCard
                            icon={Cpu}
                            label="MSPT"
                            value={overview.currentMspt ? `${overview.currentMspt.toFixed(1)}ms` : "N/A"}
                            accent={overview.currentMspt && overview.currentMspt <= 50 ? "text-green-500" : "text-red-500"}
                        />
                        <StatCard
                            icon={MemoryStick}
                            label="Memory Used"
                            value={overview.memoryUsedMB ? `${overview.memoryUsedMB.toFixed(0)} MB` : "N/A"}
                            accent="text-cyan-500"
                        />
                        <StatCard
                            icon={MemoryStick}
                            label="Memory Max"
                            value={overview.memoryMaxMB ? `${overview.memoryMaxMB.toFixed(0)} MB` : "N/A"}
                            accent="text-slate-500"
                        />
                    </div>

                    {/* TPS Chart */}
                    {tps.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">TPS History</CardTitle>
                                <CardDescription className="text-xs">Ticks per second (ideal: 20.0)</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={220}>
                                    <LineChart data={tps}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <Tooltip labelFormatter={formatTimestamp} contentStyle={tooltipStyle} />
                                        <Line type="monotone" dataKey="tps" stroke="#10b981" strokeWidth={2} dot={false} name="TPS" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* MSPT Chart */}
                    {msptData.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">MSPT History</CardTitle>
                                <CardDescription className="text-xs">Milliseconds per tick (lower is better, &lt;50ms ideal)</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={msptData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <Tooltip labelFormatter={formatTimestamp} contentStyle={tooltipStyle} />
                                        <Area type="monotone" dataKey="mspt" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={2} name="MSPT" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* Memory Chart */}
                    {memory.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                                <CardDescription className="text-xs">JVM heap memory over time</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={220}>
                                    <AreaChart data={memory}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <Tooltip labelFormatter={formatTimestamp} contentStyle={tooltipStyle} />
                                        <Area type="monotone" dataKey="usedMB" name="Used MB" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} strokeWidth={2} />
                                        <Area type="monotone" dataKey="maxMB" name="Max MB" stroke="#94a3b8" fill="none" strokeWidth={1} strokeDasharray="5 5" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    {tps.length === 0 && memory.length === 0 && (
                        <Card>
                            <CardContent className="py-8">
                                <div className="text-center text-muted-foreground text-sm">
                                    <p>Performance charts will appear once the server has been running for a while.</p>
                                    <p className="text-xs mt-1">Data is collected every 60 seconds.</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* ===== PLAYERS TAB ===== */}
                <TabsContent value="players" className="space-y-4 mt-4">
                    {/* Distribution Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Minecraft Versions - Bar Chart */}
                        {versions && versions.length > 0 && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                                        <Gamepad2 className="h-4 w-4" />
                                        Minecraft Versions
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={versions} layout="vertical" margin={{ left: 60 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                            <YAxis type="category" dataKey="version" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={55} />
                                            <Tooltip contentStyle={tooltipStyle} />
                                            <Bar dataKey="count" name="Players" radius={[0, 4, 4, 0]}>
                                                {versions.map((_, index) => (
                                                    <Cell key={`v-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} fillOpacity={0.8} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}

                        {/* Client Brands - Pie Chart */}
                        {clients && clients.length > 0 && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                                        <Monitor className="h-4 w-4" />
                                        Player Clients
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie
                                                data={clients}
                                                dataKey="count"
                                                nameKey="client"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={75}
                                                innerRadius={40}
                                                paddingAngle={2}
                                                label={({ client, percent }) => `${client} ${(percent * 100).toFixed(0)}%`}
                                                labelLine={false}
                                            >
                                                {clients.map((_, index) => (
                                                    <Cell key={`c-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={tooltipStyle} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}

                        {/* Countries - Pie Chart */}
                        {geo.length > 0 && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                                        <Globe className="h-4 w-4" />
                                        Player Countries
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie
                                                data={geo}
                                                dataKey="count"
                                                nameKey="country"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={75}
                                                innerRadius={40}
                                                paddingAngle={2}
                                                label={({ country, percent }) => `${country} ${(percent * 100).toFixed(0)}%`}
                                                labelLine={false}
                                            >
                                                {geo.map((_, index) => (
                                                    <Cell key={`g-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={tooltipStyle} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}

                        {/* Operating Systems - Pie Chart */}
                        {operatingSystems && operatingSystems.length > 0 && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                                        <Monitor className="h-4 w-4" />
                                        Operating Systems
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie
                                                data={operatingSystems}
                                                dataKey="count"
                                                nameKey="os"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={75}
                                                innerRadius={40}
                                                paddingAngle={2}
                                                label={({ os, percent }) => `${os} ${(percent * 100).toFixed(0)}%`}
                                                labelLine={false}
                                            >
                                                {operatingSystems.map((_, index) => (
                                                    <Cell key={`os-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={tooltipStyle} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Player List */}
                    {players.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Players ({players.length})
                                </CardTitle>
                                <CardDescription className="text-xs">Sorted by playtime</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                                    <div className="grid grid-cols-[2rem_1fr_auto_auto_auto_auto] gap-2 px-2 py-1.5 text-xs text-muted-foreground font-medium border-b border-border/50">
                                        <span>#</span>
                                        <span>Player</span>
                                        <span className="text-right w-16">Playtime</span>
                                        <span className="text-right w-16">Version</span>
                                        <span className="text-right w-20">Client</span>
                                        <span className="text-right w-16">Country</span>
                                    </div>
                                    {[...players]
                                        .sort((a, b) => b.totalPlayTimeSeconds - a.totalPlayTimeSeconds)
                                        .slice(0, 30)
                                        .map((p, i) => (
                                            <div key={p.uuid} className="grid grid-cols-[2rem_1fr_auto_auto_auto_auto] gap-2 items-center py-1.5 px-2 rounded-md hover:bg-muted/50">
                                                <span className="text-xs text-muted-foreground">#{i + 1}</span>
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-sm font-medium truncate">{p.name}</span>
                                                    {p.online && (
                                                        <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] px-1.5 shrink-0">
                                                            Online
                                                        </Badge>
                                                    )}
                                                </div>
                                                <span className="text-xs text-muted-foreground text-right w-16">
                                                    {formatPlayTime(p.totalPlayTimeSeconds)}
                                                </span>
                                                <span className="text-xs text-muted-foreground text-right w-16">
                                                    {p.clientVersion || "—"}
                                                </span>
                                                <span className="text-xs text-muted-foreground text-right w-20 truncate">
                                                    {p.clientBrand || "—"}
                                                </span>
                                                <span className="text-xs text-muted-foreground text-right w-16 truncate">
                                                    {p.country || "—"}
                                                </span>
                                            </div>
                                        ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {players.length === 0 && (!versions || versions.length === 0) && geo.length === 0 && (
                        <Card>
                            <CardContent className="py-8">
                                <div className="text-center text-muted-foreground text-sm">
                                    <p>Player data will appear once players join the server.</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* ===== SETTINGS TAB ===== */}
                <TabsContent value="settings" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                Tracking Settings
                            </CardTitle>
                            <CardDescription className="text-xs">
                                These settings are configured in the plugin&apos;s config.yml file.
                                Edit <code className="bg-muted px-1 py-0.5 rounded text-[11px]">plugins/CatalystAnalytics/config.yml</code> on your server to change them.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {trackingSettings ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <SettingRow label="Player Joins" enabled={trackingSettings.trackPlayerJoins} description="Track join/leave events" />
                                    <SettingRow label="Player Versions" enabled={trackingSettings.trackPlayerVersions} description="Detect Minecraft version" />
                                    <SettingRow label="Player Clients" enabled={trackingSettings.trackPlayerClients} description="Detect client brand (Fabric, Forge, etc.)" />
                                    <SettingRow label="Geolocation" enabled={trackingSettings.trackGeolocation} description="Country detection via IP" />
                                    <SettingRow label="Operating System" enabled={trackingSettings.trackOs} description="Detect player OS" />
                                    <SettingRow label="TPS Tracking" enabled={trackingSettings.trackTps} description="Server TPS over time" />
                                    <SettingRow label="RAM Tracking" enabled={trackingSettings.trackRam} description="Memory usage over time" />
                                    <SettingRow label="Playtime" enabled={trackingSettings.trackPlaytime} description="Track session durations" />
                                    <SettingRow label="Chat Messages" enabled={trackingSettings.trackChatMessages} description="Count chat messages" />
                                    <SettingRow label="Deaths & Kills" enabled={trackingSettings.trackDeathsKills} description="Track PvP and deaths" />
                                    <SettingRow label="Blocks" enabled={trackingSettings.trackBlocks} description="Track blocks placed/broken" />
                                    <SettingRow label="Commands" enabled={trackingSettings.trackCommands} description="Track commands executed" />
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground text-sm py-4">
                                    <p>Tracking settings will appear once the server is running with the latest CatalystAnalytics plugin.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}

// Stat card component
function StatCard({
    icon: Icon,
    label,
    value,
    accent,
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: string | number
    accent?: string
}) {
    return (
        <Card className="relative overflow-hidden">
            <CardContent className="p-3">
                <div className="flex items-center gap-3">
                    <div className={`rounded-md bg-muted p-2 ${accent || ""}`}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                        <p className="text-base font-bold truncate">{value}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

// Setting row component (read-only display)
function SettingRow({
    label,
    enabled,
    description,
}: {
    label: string
    enabled: boolean
    description: string
}) {
    return (
        <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
            <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Badge
                variant="secondary"
                className={enabled
                    ? "bg-green-500/10 text-green-600 border-green-500/20"
                    : "bg-red-500/10 text-red-500 border-red-500/20"
                }
            >
                {enabled ? "Enabled" : "Disabled"}
            </Badge>
        </div>
    )
}
