import { useState, useEffect, useCallback, useRef } from "react"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Users,
    Clock,
    Gauge,
    MemoryStick,
    Skull,
    Sword,
    TrendingUp,
    Activity,
    Timer,
    Server,
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
} from "recharts"

// Types matching the analytics.json structure from the plugin
interface AnalyticsData {
    server: {
        uptimeMs: number
        currentOnline: number
        peakOnline: number
        maxPlayers: number
        uniquePlayers: number
        totalJoins: number
        currentTps: number | null
        memoryUsedMB: number | null
        memoryMaxMB: number | null
    }
    players: Array<{
        uuid: string
        name: string
        online: boolean
        firstJoin: string
        lastJoin: string
        joinCount: number
        totalPlayTimeSeconds: number
        country: string | null
        clientVersion: string | null
        deaths: number
        kills: number
    }>
    tpsHistory: Array<{ timestamp: string; tps: number }>
    memoryHistory: Array<{ timestamp: string; usedMB: number; maxMB: number }>
    playerCountTimeline: Array<{ timestamp: string; players: number }>
    exportedAt: string
}

interface AnalyticsTabProps {
    serverId: string
}

const POLL_INTERVAL_MS = 7000 // Poll every 7 seconds

/**
 * Analytics tab component for the server detail page.
 * Reads analytics data directly from the filesystem via IPC — zero configuration needed.
 */
export function AnalyticsTab({ serverId }: AnalyticsTabProps) {
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [status, setStatus] = useState<"loading" | "no-data" | "ready" | "error">("loading")
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const loadData = useCallback(async () => {
        try {
            const result = await window.context.readAnalyticsData(serverId)
            if (result.success && result.data) {
                setData(result.data as AnalyticsData)
                setStatus("ready")
                setErrorMsg(null)
            } else if (result.error === "no-data-file") {
                setStatus("no-data")
                setErrorMsg(null)
            } else {
                // Keep showing old data if we have it
                if (!data) {
                    setStatus("error")
                    setErrorMsg(result.error || "Unknown error")
                }
            }
        } catch (err) {
            if (!data) {
                setStatus("error")
                setErrorMsg(err instanceof Error ? err.message : "Unknown error")
            }
        }
    }, [serverId]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        loadData()
        intervalRef.current = setInterval(loadData, POLL_INTERVAL_MS)
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [loadData])

    const formatPlayTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        if (hours > 0) return `${hours}h ${minutes}m`
        return `${minutes}m`
    }

    const formatUptime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000)
        const days = Math.floor(totalSeconds / 86400)
        const hours = Math.floor((totalSeconds % 86400) / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        if (days > 0) return `${days}d ${hours}h ${minutes}m`
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

    // No data file — server hasn't started with the plugin yet
    if (status === "no-data") {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <Server className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Start your server to see analytics</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                    Analytics data will appear here automatically once your server is running
                    with the CatalystAnalytics plugin installed. No configuration needed.
                </p>
            </div>
        )
    }

    // Loading state (first load only)
    if (status === "loading") {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <Activity className="h-8 w-8 text-primary animate-pulse mb-3" />
                <span className="text-sm text-muted-foreground">Loading analytics...</span>
            </div>
        )
    }

    // Error state
    if (status === "error") {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <Server className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Could not load analytics</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                    {errorMsg || "An unexpected error occurred. Make sure the server has been started at least once with the CatalystAnalytics plugin."}
                </p>
            </div>
        )
    }

    if (!data) return null

    const { server, players, tpsHistory, memoryHistory, playerCountTimeline } = data
    const onlinePlayers = players.filter(p => p.online)

    return (
        <div className="space-y-6 pb-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Players Online" value={`${server.currentOnline} / ${server.maxPlayers}`} accent="text-green-500" />
                <StatCard icon={TrendingUp} label="Peak Online" value={server.peakOnline} accent="text-blue-500" />
                <StatCard icon={Gauge} label="TPS" value={server.currentTps !== null ? server.currentTps.toFixed(1) : "N/A"} accent="text-emerald-500" />
                <StatCard icon={MemoryStick} label="RAM Usage" value={server.memoryUsedMB !== null ? `${server.memoryUsedMB} / ${server.memoryMaxMB} MB` : "N/A"} accent="text-cyan-500" />
                <StatCard icon={Timer} label="Uptime" value={formatUptime(server.uptimeMs)} accent="text-amber-500" />
                <StatCard icon={Users} label="Unique Players" value={server.uniquePlayers} accent="text-purple-500" />
                <StatCard icon={Skull} label="Total Deaths" value={players.reduce((sum, p) => sum + p.deaths, 0)} accent="text-red-500" />
                <StatCard icon={Sword} label="Total Kills" value={players.reduce((sum, p) => sum + p.kills, 0)} accent="text-orange-500" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Player Count Timeline */}
                {playerCountTimeline.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Player Count Over Time</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={playerCountTimeline}>
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
                {tpsHistory.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">TPS History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={tpsHistory}>
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
                {memoryHistory.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={memoryHistory}>
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
            </div>

            {/* Online Players & Top Players */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Currently Online */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Online Players ({onlinePlayers.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {onlinePlayers.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">No players online</p>
                        ) : (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {onlinePlayers.map((p) => (
                                    <div key={p.uuid} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">{p.name}</span>
                                            <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] px-1.5">Online</Badge>
                                        </div>
                                        <span className="text-sm text-muted-foreground">{formatPlayTime(p.totalPlayTimeSeconds)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Top Players by Playtime */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Top Players by Playtime
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {players.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">No player data yet</p>
                        ) : (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {players.slice(0, 15).map((p, i) => (
                                    <div key={p.uuid} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                                            <span className="text-sm font-medium">{p.name}</span>
                                            {p.online && <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] px-1.5">Online</Badge>}
                                        </div>
                                        <span className="text-sm text-muted-foreground">{formatPlayTime(p.totalPlayTimeSeconds)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

// Stat card helper component
function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string | number; accent: string }) {
    return (
        <Card>
            <CardContent className="flex items-center gap-3 py-4 px-4">
                <Icon className={`h-5 w-5 ${accent}`} />
                <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-semibold">{value}</p>
                </div>
            </CardContent>
        </Card>
    )
}
