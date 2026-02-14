import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
    Users,
    Clock,
    Gauge,
    MemoryStick,
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
    Settings,
    Gamepad2,
    Layers,
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

const PIE_COLORS = [
    "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
    "#f43f5e", "#ef4444", "#f97316", "#eab308", "#84cc16",
    "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#2563eb",
]

/**
 * Tooltip style for all charts — white text, dark background, no white hover.
 */
const CHART_TOOLTIP_STYLE: React.CSSProperties = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
    color: "#ffffff",
}

/**
 * Custom tooltip for bar charts to prevent white hover background.
 */
function BarChartTooltip({ active, payload, label }: any) {
    if (!active || !payload || !payload.length) return null
    return (
        <div style={CHART_TOOLTIP_STYLE} className="px-3 py-2 shadow-lg">
            <p className="text-xs font-medium" style={{ color: "#ffffff" }}>{label}</p>
            {payload.map((entry: any, i: number) => (
                <p key={i} className="text-xs" style={{ color: entry.color || "#ffffff" }}>
                    {entry.name}: {entry.value}
                </p>
            ))}
        </div>
    )
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
    const [showSettings, setShowSettings] = useState(false)
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

    return (
        <AnalyticsContent
            data={displayData}
            serverOffline={serverOffline}
            isLive={!serverOffline && !!data}
            lastUpdated={lastUpdated}
            showSettings={showSettings}
            setShowSettings={setShowSettings}
            formatPlayTime={formatPlayTime}
            formatTimestamp={formatTimestamp}
            formatUptime={formatUptime}
        />
    )
}

// ═══════════════════════════════════════════════════════════
// Main Content Component
// ═══════════════════════════════════════════════════════════
function AnalyticsContent({
    data,
    serverOffline,
    isLive,
    lastUpdated,
    showSettings,
    setShowSettings,
    formatPlayTime,
    formatTimestamp,
    formatUptime,
}: {
    data: AnalyticsData
    serverOffline: boolean
    isLive: boolean
    lastUpdated: string | null
    showSettings: boolean
    setShowSettings: (v: boolean) => void
    formatPlayTime: (s: number) => string
    formatTimestamp: (ts: string) => string
    formatUptime: (s?: string) => string
}) {
    const { overview, players, tps, mspt, memory, timeline, versions, clients } = data

    // Prepare hourly joins chart data
    const hourlyData = useMemo(() => {
        if (!overview?.hourlyJoins) return []
        return Object.entries(overview.hourlyJoins)
            .map(([hour, count]) => ({
                hour: `${hour.padStart(2, "0")}:00`,
                joins: count,
            }))
            .sort((a, b) => a.hour.localeCompare(b.hour))
    }, [overview?.hourlyJoins])

    // Version data — use top-level versions or aggregate from players
    const versionData = useMemo(() => {
        if (versions && versions.length > 0) return versions
        const vMap: Record<string, number> = {}
        players.forEach(p => {
            if (p.clientVersion) vMap[p.clientVersion] = (vMap[p.clientVersion] || 0) + 1
        })
        return Object.entries(vMap)
            .map(([version, count]) => ({ version, count }))
            .sort((a, b) => b.count - a.count)
    }, [versions, players])

    // Client data — use top-level clients or aggregate from players
    const clientData = useMemo(() => {
        if (clients && clients.length > 0) return clients
        const cMap: Record<string, number> = {}
        players.forEach(p => {
            const brand = normalizeClientBrand(p.clientBrand)
            if (brand) cMap[brand] = (cMap[brand] || 0) + 1
        })
        return Object.entries(cMap)
            .map(([client, count]) => ({ client, count }))
            .sort((a, b) => b.count - a.count)
    }, [clients, players])

    return (
        <div className="space-y-6 pb-8">
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
                    {isLive && (
                        <Badge variant="secondary" className="gap-1 text-green-500 border-green-500/20 bg-green-500/10">
                            <Activity className="h-3 w-3" />
                            Live
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" />
                            Updated {formatTimestamp(lastUpdated)}
                        </span>
                    )}
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors"
                        title="Tracking Settings"
                    >
                        <Settings className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && data.trackingConfig && (
                <TrackingSettings config={data.trackingConfig} />
            )}
            {showSettings && !data.trackingConfig && (
                <Card>
                    <CardContent className="py-4">
                        <p className="text-sm text-muted-foreground">
                            Tracking settings are configured in the plugin&apos;s <code className="text-xs bg-muted px-1 py-0.5 rounded">config.yml</code> file.
                            Update the plugin to v2.1+ to manage settings from here.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* SECTION 1: Overview — Players, Playtime, Peak Players     */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section>
                <SectionHeader icon={TrendingUp} title="Overview" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard icon={Users} label="Online" value={overview.currentOnline} accent="text-green-500" />
                    <StatCard icon={TrendingUp} label="Peak Online" value={overview.peakOnline} accent="text-blue-500" />
                    <StatCard icon={Users} label="Unique Players" value={overview.uniquePlayers} accent="text-purple-500" />
                    <StatCard icon={Clock} label="Avg Play Time" value={formatPlayTime(overview.averagePlayTimeSeconds)} accent="text-amber-500" />
                    <StatCard icon={Timer} label="Uptime" value={formatUptime(overview.serverStartTime)} accent="text-teal-500" />
                    <StatCard icon={TrendingUp} label="Total Joins" value={overview.totalJoins} accent="text-violet-500" />
                    <StatCard icon={Users} label="New Players" value={overview.newPlayers} accent="text-pink-500" />
                    <StatCard icon={Skull} label="Deaths" value={overview.totalDeaths} accent="text-red-500" />
                </div>

                {/* Player Count Timeline — Area Chart */}
                {timeline && timeline.length > 0 && (
                    <Card className="mt-4">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Player Count Over Time</CardTitle>
                            <CardDescription className="text-xs">Online players timeline</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={timeline}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                    <Tooltip labelFormatter={formatTimestamp} contentStyle={CHART_TOOLTIP_STYLE} itemStyle={{ color: "#ffffff" }} labelStyle={{ color: "#ffffff" }} />
                                    <Area type="monotone" dataKey="players" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* SECTION 2: Performance — TPS, RAM, MSPT                   */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section>
                <SectionHeader icon={Cpu} title="Performance" />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                    <StatCard icon={Gauge} label="Current TPS" value={overview.currentTps?.toFixed(1) ?? "N/A"} accent="text-emerald-500" />
                    <StatCard icon={MemoryStick} label="Memory" value={overview.memoryUsedMB ? `${overview.memoryUsedMB.toFixed(0)} / ${overview.memoryMaxMB?.toFixed(0)} MB` : "N/A"} accent="text-cyan-500" />
                    <StatCard icon={Activity} label="MSPT" value={overview.currentMspt?.toFixed(1) ?? "N/A"} accent="text-violet-500" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* TPS Chart — Line Chart */}
                    {tps && tps.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">TPS History</CardTitle>
                                <CardDescription className="text-xs">Ticks per second over time (ideal: 20)</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={200}>
                                    <LineChart data={tps}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <Tooltip labelFormatter={formatTimestamp} contentStyle={CHART_TOOLTIP_STYLE} itemStyle={{ color: "#ffffff" }} labelStyle={{ color: "#ffffff" }} />
                                        <Line type="monotone" dataKey="tps" stroke="#10b981" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* Memory Chart — Area Chart */}
                    {memory && memory.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                                <CardDescription className="text-xs">JVM heap memory over time</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={memory}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <Tooltip labelFormatter={formatTimestamp} contentStyle={CHART_TOOLTIP_STYLE} itemStyle={{ color: "#ffffff" }} labelStyle={{ color: "#ffffff" }} />
                                        <Area type="monotone" dataKey="usedMB" name="Used MB" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} strokeWidth={2} />
                                        <Area type="monotone" dataKey="maxMB" name="Max MB" stroke="#94a3b8" fill="none" strokeWidth={1} strokeDasharray="5 5" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* MSPT Chart — Area Chart */}
                    {mspt && mspt.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">MSPT History</CardTitle>
                                <CardDescription className="text-xs">Milliseconds per tick (ideal: &lt;50ms)</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={mspt}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <Tooltip labelFormatter={formatTimestamp} contentStyle={CHART_TOOLTIP_STYLE} itemStyle={{ color: "#ffffff" }} labelStyle={{ color: "#ffffff" }} />
                                        <Area type="monotone" dataKey="mspt" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* SECTION 3: Players — Versions (Bar), Clients (Pie)        */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section>
                <SectionHeader icon={Gamepad2} title="Players" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Minecraft Versions — Bar Chart */}
                    {versionData.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Layers className="h-4 w-4" />
                                    Minecraft Versions
                                </CardTitle>
                                <CardDescription className="text-xs">Player client versions</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={versionData.slice(0, 10)} layout="vertical" style={{ cursor: "default" }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <YAxis type="category" dataKey="version" width={90} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <Tooltip content={<BarChartTooltip />} cursor={false} />
                                        <Bar dataKey="count" name="Players" radius={[0, 4, 4, 0]}>
                                            {versionData.slice(0, 10).map((_, index) => (
                                                <Cell key={`v-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} fillOpacity={0.8} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* Client Brands — Pie Chart */}
                    {clientData.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Monitor className="h-4 w-4" />
                                    Client Brands
                                </CardTitle>
                                <CardDescription className="text-xs">Lunar, Fabric, Forge, Vanilla, etc.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie
                                            data={clientData}
                                            dataKey="count"
                                            nameKey="client"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={75}
                                            innerRadius={40}
                                            paddingAngle={2}
                                            label={({ client, percent }) => `${client} ${(percent * 100).toFixed(0)}%`}
                                            labelLine={false}
                                            isAnimationActive={false}
                                        >
                                            {clientData.map((_, index) => (
                                                <Cell key={`c-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} itemStyle={{ color: "#ffffff" }} labelStyle={{ color: "#ffffff" }} />
                                        <Legend wrapperStyle={{ fontSize: 11, color: "#ffffff" }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* Top Players by Playtime */}
                    {players.length > 0 && (
                        <Card className="lg:col-span-2">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Top Players by Playtime
                                </CardTitle>
                                <CardDescription className="text-xs">{players.length} total players tracked</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                                    {[...players]
                                        .sort((a, b) => b.totalPlayTimeSeconds - a.totalPlayTimeSeconds)
                                        .slice(0, 15)
                                        .map((p, i) => (
                                            <div key={p.uuid} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground w-5 font-mono">#{i + 1}</span>
                                                    <img
                                                        src={`https://minotar.net/helm/${p.name}/32`}
                                                        alt={p.name}
                                                        className="h-6 w-6 rounded"
                                                        loading="lazy"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                                    />
                                                    <span className="text-sm font-medium">{p.name}</span>
                                                    {p.online && (
                                                        <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] px-1.5">
                                                            Online
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {p.clientVersion && (
                                                        <Badge variant="outline" className="text-[10px] px-1.5">
                                                            {p.clientVersion}
                                                        </Badge>
                                                    )}
                                                    <span className="text-xs text-muted-foreground font-mono">
                                                        {formatPlayTime(p.totalPlayTimeSeconds)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* SECTION 4: Most Active Hours                              */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section>
                <SectionHeader icon={Clock} title="Most Active Hours" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Peak Hours — Bar Chart */}
                    {hourlyData.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Hourly Join Distribution (UTC)</CardTitle>
                                <CardDescription className="text-xs">When players are most active</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={hourlyData} style={{ cursor: "default" }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <Tooltip content={<BarChartTooltip />} cursor={false} />
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

                    {/* Additional stats */}
                    <div className="grid grid-cols-2 gap-3 content-start">
                        <StatCard icon={Sword} label="Kills" value={overview.totalKills} accent="text-orange-500" />
                        <StatCard icon={MessageSquare} label="Chat Messages" value={overview.totalChatMessages} accent="text-indigo-500" />
                        <StatCard icon={Terminal} label="Commands" value={overview.totalCommandsExecuted} accent="text-slate-500" />
                        <StatCard icon={TrendingUp} label="Returning" value={overview.returningPlayers} accent="text-emerald-500" />
                    </div>
                </div>
            </section>

            {/* No charts/players yet but have overview */}
            {(!timeline || timeline.length === 0) && (!tps || tps.length === 0) && (!memory || memory.length === 0) && players.length === 0 && (
                <Card>
                    <CardContent className="py-8">
                        <div className="text-center text-muted-foreground text-sm">
                            <p>Charts and player details will appear once the server has been running for a while.</p>
                            <p className="text-xs mt-1">Data is collected every 30-60 seconds.</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════
// Helper Components
// ═══════════════════════════════════════════════════════════

function SectionHeader({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h4>
            <div className="flex-1 h-px bg-border" />
        </div>
    )
}

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
            <CardContent className="p-4">
                <div className="flex items-center gap-3">
                    <div className={`rounded-md bg-muted p-2 ${accent || ""}`}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                        <p className="text-lg font-bold truncate">{value}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function TrackingSettings({ config }: { config: NonNullable<AnalyticsData["trackingConfig"]> }) {
    const settings = [
        { key: "track-player-joins" as const, label: "Player Joins/Leaves", description: "Track when players join and leave" },
        { key: "track-player-versions" as const, label: "Player Versions", description: "Detect Minecraft client versions" },
        { key: "track-player-clients" as const, label: "Client Brands", description: "Detect Lunar, Fabric, Forge, etc." },
        { key: "track-geolocation" as const, label: "Geolocation", description: "Look up player countries via IP" },
        { key: "track-os" as const, label: "Operating System", description: "Detect player OS (Windows, macOS, Linux)" },
        { key: "track-tps" as const, label: "TPS Monitoring", description: "Track server ticks per second" },
        { key: "track-ram" as const, label: "RAM Monitoring", description: "Track JVM memory usage" },
        { key: "track-playtime" as const, label: "Play Time", description: "Track player session durations" },
        { key: "track-fps" as const, label: "FPS Collection", description: "Collect player FPS data (if available)" },
    ]

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Tracking Settings
                </CardTitle>
                <CardDescription className="text-xs">
                    These settings are read from the plugin config. Edit <code className="bg-muted px-1 py-0.5 rounded">plugins/CatalystAnalytics/config.yml</code> to change them.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {settings.map(s => (
                        <div key={s.key} className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border/50">
                            <div className="min-w-0">
                                <p className="text-sm font-medium">{s.label}</p>
                                <p className="text-xs text-muted-foreground">{s.description}</p>
                            </div>
                            <Switch checked={config[s.key]} disabled className="ml-3 shrink-0" />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

/**
 * Normalize client brand strings to friendly names.
 */
function normalizeClientBrand(brand?: string): string | null {
    if (!brand) return null
    const lower = brand.toLowerCase().trim()
    if (lower.includes("lunarclient") || lower.includes("lunar")) return "Lunar Client"
    if (lower.includes("badlion") || lower.includes("blc")) return "Badlion Client"
    if (lower.includes("fabric")) return "Fabric"
    if (lower.includes("forge") || lower.includes("fml")) return "Forge"
    if (lower.includes("quilt")) return "Quilt"
    if (lower.includes("optifine")) return "OptiFine"
    if (lower.includes("labymod")) return "LabyMod"
    if (lower.includes("feather")) return "Feather Client"
    if (lower === "vanilla" || lower === "minecraft" || lower === "brand") return "Vanilla"
    return brand
}
