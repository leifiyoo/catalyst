import { useState, useEffect, useCallback, useRef } from "react"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
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
    Box,
    RefreshCw,
    TrendingUp,
    Activity,
    ServerOff,
    BarChart3,
    Timer,
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
} from "recharts"
import type { AnalyticsData } from "@shared/types"

interface AnalyticsTabProps {
    serverId: string
}

const POLL_INTERVAL = 7000 // 7 seconds

/**
 * Analytics tab component — reads data directly from the filesystem.
 * No API, no connect button, no configuration needed.
 * The CatalystAnalytics plugin writes analytics.json which the Electron
 * main process reads and passes to this component via IPC.
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
                // No analytics file yet — show empty state
                if (lastDataRef.current) {
                    // We had data before, server might have stopped
                    setServerOffline(true)
                } else {
                    setNoData(true)
                }
            }
        } catch {
            // Silent fail — keep showing last known data
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

    // No data yet — friendly empty state
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

    // Use current data or last known data
    const displayData = data || lastDataRef.current
    if (!displayData) return null

    const { overview, players, tps, memory, timeline, geo } = displayData

    // Prepare hourly joins chart data
    const hourlyData = overview?.hourlyJoins
        ? Object.entries(overview.hourlyJoins)
              .map(([hour, count]) => ({
                  hour: `${hour.padStart(2, "0")}:00`,
                  joins: count,
              }))
              .sort((a, b) => a.hour.localeCompare(b.hour))
        : []

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

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={Users} label="Online" value={overview.currentOnline} accent="text-green-500" />
                <StatCard icon={TrendingUp} label="Peak Online" value={overview.peakOnline} accent="text-blue-500" />
                <StatCard icon={Users} label="Unique Players" value={overview.uniquePlayers} accent="text-purple-500" />
                <StatCard icon={Timer} label="Uptime" value={formatUptime(overview.serverStartTime)} accent="text-teal-500" />
                <StatCard icon={Gauge} label="Current TPS" value={overview.currentTps?.toFixed(1) ?? "N/A"} accent="text-emerald-500" />
                <StatCard icon={MemoryStick} label="Memory" value={overview.memoryUsedMB ? `${overview.memoryUsedMB.toFixed(0)} / ${overview.memoryMaxMB?.toFixed(0)} MB` : "N/A"} accent="text-cyan-500" />
                <StatCard icon={Clock} label="Avg Play Time" value={formatPlayTime(overview.averagePlayTimeSeconds)} accent="text-amber-500" />
                <StatCard icon={Skull} label="Deaths" value={overview.totalDeaths} accent="text-red-500" />
                <StatCard icon={Sword} label="Kills" value={overview.totalKills} accent="text-orange-500" />
                <StatCard icon={MessageSquare} label="Chat Messages" value={overview.totalChatMessages} accent="text-indigo-500" />
                <StatCard icon={Terminal} label="Commands" value={overview.totalCommandsExecuted} accent="text-slate-500" />
                <StatCard icon={Box} label="Blocks Placed" value={overview.totalBlocksPlaced} accent="text-lime-500" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Player Count Timeline */}
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
                                    <Tooltip labelFormatter={formatTimestamp} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                                    <Area type="monotone" dataKey="players" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {/* TPS Chart */}
                {tps.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">TPS History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={tps}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                    <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                    <Tooltip labelFormatter={formatTimestamp} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                                    <Line type="monotone" dataKey="tps" stroke="#10b981" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {/* Memory Chart */}
                {memory.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={memory}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                    <Tooltip labelFormatter={formatTimestamp} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                                    <Area type="monotone" dataKey="usedMB" name="Used MB" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} strokeWidth={2} />
                                    <Area type="monotone" dataKey="maxMB" name="Max MB" stroke="#94a3b8" fill="none" strokeWidth={1} strokeDasharray="5 5" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {/* Peak Hours Chart */}
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
                                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
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

            {/* Players & Geo */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Geo Distribution */}
                {geo.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Globe className="h-4 w-4" />
                                Player Locations
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {geo.map((g) => (
                                    <div key={g.country} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
                                        <span className="text-sm">{g.country}</span>
                                        <Badge variant="secondary">{g.count}</Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Top Players by Playtime */}
                {players.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Players
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {[...players]
                                    .sort((a, b) => b.totalPlayTimeSeconds - a.totalPlayTimeSeconds)
                                    .slice(0, 20)
                                    .map((p, i) => (
                                        <div key={p.uuid} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                                                <span className="text-sm font-medium">{p.name}</span>
                                                {p.online && (
                                                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] px-1.5">
                                                        Online
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-muted-foreground">
                                                    {formatPlayTime(p.totalPlayTimeSeconds)}
                                                </span>
                                                {p.lastJoin && (
                                                    <span className="text-xs text-muted-foreground/60">
                                                        Last: {formatTimestamp(p.lastJoin)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* No charts/players yet but have overview */}
            {timeline.length === 0 && tps.length === 0 && memory.length === 0 && players.length === 0 && (
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
