import { useState, useEffect, useCallback } from "react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
    BarChart3,
    Activity,
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

// Types for analytics API responses
interface AnalyticsOverview {
    currentOnline: number
    peakOnline: number
    uniquePlayers: number
    totalJoins: number
    newPlayers: number
    returningPlayers: number
    averagePlayTimeSeconds: number
    totalChatMessages: number
    totalCommandsExecuted: number
    totalBlocksPlaced: number
    totalBlocksBroken: number
    totalDeaths: number
    totalKills: number
    currentTps?: number
    memoryUsedMB?: number
    memoryMaxMB?: number
    hourlyJoins?: Record<string, number>
}

interface AnalyticsPlayer {
    uuid: string
    name: string
    online: boolean
    firstJoin: string
    lastJoin: string
    joinCount: number
    totalPlayTimeSeconds: number
    country?: string
    region?: string
    clientVersion?: string
    clientBrand?: string
    chatMessages: number
    deaths: number
    kills: number
    blocksPlaced: number
    blocksBroken: number
    commandsExecuted: number
}

interface TpsEntry {
    timestamp: string
    tps: number
}

interface MemoryEntry {
    timestamp: string
    usedMB: number
    maxMB: number
}

interface GeoEntry {
    country: string
    count: number
}

interface TimelineEntry {
    timestamp: string
    players: number
}

interface AnalyticsTabProps {
    serverId: string
    serverPort?: number
}

const ANALYTICS_PORT = 7845
const ANALYTICS_KEY = "change-me-to-a-secure-key" // Default key; user should configure

/**
 * Analytics tab component for the server detail page.
 * Fetches data from the CatalystAnalytics plugin REST API.
 */
export function AnalyticsTab({ serverId }: AnalyticsTabProps) {
    const [apiPort, setApiPort] = useState(ANALYTICS_PORT)
    const [apiKey, setApiKey] = useState(ANALYTICS_KEY)
    const [configured, setConfigured] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Data states
    const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
    const [players, setPlayers] = useState<AnalyticsPlayer[]>([])
    const [tpsData, setTpsData] = useState<TpsEntry[]>([])
    const [memoryData, setMemoryData] = useState<MemoryEntry[]>([])
    const [geoData, setGeoData] = useState<GeoEntry[]>([])
    const [timelineData, setTimelineData] = useState<TimelineEntry[]>([])

    const fetchApi = useCallback(async (endpoint: string) => {
        const res = await fetch(`http://localhost:${apiPort}${endpoint}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!res.ok) {
            throw new Error(`API error: ${res.status} ${res.statusText}`)
        }
        return res.json()
    }, [apiPort, apiKey])

    const loadAllData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const [overviewRes, playersRes, tpsRes, memRes, geoRes, timelineRes] = await Promise.all([
                fetchApi("/api/analytics/overview"),
                fetchApi("/api/analytics/players"),
                fetchApi("/api/analytics/tps"),
                fetchApi("/api/analytics/memory"),
                fetchApi("/api/analytics/geo"),
                fetchApi("/api/analytics/timeline"),
            ])
            setOverview(overviewRes)
            setPlayers(playersRes.players || [])
            setTpsData(tpsRes.tps || [])
            setMemoryData(memRes.memory || [])
            setGeoData(geoRes.geo || [])
            setTimelineData(timelineRes.timeline || [])
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to connect to CatalystAnalytics plugin")
        } finally {
            setLoading(false)
        }
    }, [fetchApi])

    useEffect(() => {
        if (configured) {
            loadAllData()
            const interval = setInterval(loadAllData, 30000) // Refresh every 30s
            return () => clearInterval(interval)
        }
    }, [configured, loadAllData])

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

    // Configuration screen
    if (!configured) {
        return (
            <div className="max-w-md mx-auto mt-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            CatalystAnalytics
                        </CardTitle>
                        <CardDescription>
                            Connect to the CatalystAnalytics plugin running on your server.
                            Make sure the plugin is installed and the server is running.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                API Port
                            </label>
                            <Input
                                type="number"
                                value={apiPort}
                                onChange={(e) => setApiPort(Number(e.target.value))}
                                placeholder="7845"
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                API Key
                            </label>
                            <Input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Your API key from config.yml"
                            />
                        </div>
                        <Button onClick={() => setConfigured(true)} className="w-full">
                            Connect
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (loading && !overview) {
        return (
            <div className="flex items-center justify-center py-20">
                <Spinner className="text-primary" />
                <span className="ml-3 text-muted-foreground">Loading analytics...</span>
            </div>
        )
    }

    if (error && !overview) {
        return (
            <div className="max-w-md mx-auto mt-8 space-y-4">
                <Alert variant="destructive">
                    <AlertTitle>Connection Failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button variant="outline" onClick={() => setConfigured(false)}>
                    Reconfigure
                </Button>
            </div>
        )
    }

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
            {/* Header with refresh */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Server Analytics</h3>
                    {loading && <Spinner className="h-4 w-4 text-muted-foreground" />}
                </div>
                <Button variant="ghost" size="sm" onClick={loadAllData} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Stats Cards */}
            {overview && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={Users} label="Online" value={overview.currentOnline} accent="text-green-500" />
                    <StatCard icon={TrendingUp} label="Peak Online" value={overview.peakOnline} accent="text-blue-500" />
                    <StatCard icon={Users} label="Unique Players" value={overview.uniquePlayers} accent="text-purple-500" />
                    <StatCard icon={Clock} label="Avg Play Time" value={formatPlayTime(overview.averagePlayTimeSeconds)} accent="text-amber-500" />
                    <StatCard icon={Gauge} label="Current TPS" value={overview.currentTps?.toFixed(1) ?? "N/A"} accent="text-emerald-500" />
                    <StatCard icon={MemoryStick} label="Memory" value={overview.memoryUsedMB ? `${overview.memoryUsedMB.toFixed(0)} / ${overview.memoryMaxMB?.toFixed(0)} MB` : "N/A"} accent="text-cyan-500" />
                    <StatCard icon={Skull} label="Deaths" value={overview.totalDeaths} accent="text-red-500" />
                    <StatCard icon={Sword} label="Kills" value={overview.totalKills} accent="text-orange-500" />
                    <StatCard icon={MessageSquare} label="Chat Messages" value={overview.totalChatMessages} accent="text-indigo-500" />
                    <StatCard icon={Terminal} label="Commands" value={overview.totalCommandsExecuted} accent="text-slate-500" />
                    <StatCard icon={Box} label="Blocks Placed" value={overview.totalBlocksPlaced} accent="text-lime-500" />
                    <StatCard icon={Box} label="Blocks Broken" value={overview.totalBlocksBroken} accent="text-rose-500" />
                </div>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Player Count Timeline */}
                {timelineData.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Player Count Over Time</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={timelineData}>
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
                {tpsData.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">TPS History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={tpsData}>
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
                {memoryData.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={memoryData}>
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

            {/* Geo Distribution & Top Players */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Geo Distribution */}
                {geoData.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Globe className="h-4 w-4" />
                                Player Locations
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {geoData.map((g) => (
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
                                Top Players by Playtime
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
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
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Deaths/Kills Leaderboard & Version/OS Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Deaths/Kills Leaderboard */}
                {players.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Skull className="h-4 w-4" />
                                Deaths & Kills Leaderboard
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {[...players]
                                    .sort((a, b) => b.kills - a.kills)
                                    .slice(0, 10)
                                    .map((p) => (
                                        <div key={p.uuid} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
                                            <span className="text-sm font-medium">{p.name}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-red-500">{p.deaths} deaths</span>
                                                <span className="text-xs text-orange-500">{p.kills} kills</span>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Client Version Breakdown */}
                {players.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Client Version & OS Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {/* Versions */}
                                <div>
                                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Versions</p>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(
                                            players.reduce<Record<string, number>>((acc, p) => {
                                                const v = p.clientVersion || "Unknown"
                                                acc[v] = (acc[v] || 0) + 1
                                                return acc
                                            }, {})
                                        )
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([version, count]) => (
                                                <Badge key={version} variant="secondary">
                                                    {version}: {count}
                                                </Badge>
                                            ))}
                                    </div>
                                </div>
                                {/* Client Brands (OS proxy) */}
                                <div>
                                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Client Brands</p>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(
                                            players.reduce<Record<string, number>>((acc, p) => {
                                                const b = p.clientBrand || "Unknown"
                                                acc[b] = (acc[b] || 0) + 1
                                                return acc
                                            }, {})
                                        )
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([brand, count]) => (
                                                <Badge key={brand} variant="outline">
                                                    {brand}: {count}
                                                </Badge>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* New vs Returning */}
            {overview && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">New vs Returning Players</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-green-500" />
                                <span className="text-sm">New: {overview.newPlayers}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-blue-500" />
                                <span className="text-sm">Returning: {overview.returningPlayers}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Total Joins: {overview.totalJoins}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
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
