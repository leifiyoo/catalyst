import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react"
import {
    Activity,
    BarChart3,
    Gauge,
    RefreshCw,
    ServerOff,
    Settings,
    Skull,
    Swords,
    Terminal,
} from "lucide-react"
import type { AnalyticsData } from "@shared/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { AreaChart, LineChart } from "@/components/dither-kit/area-chart"
import { Area, Line } from "@/components/dither-kit/area"
import { BarChart } from "@/components/dither-kit/bar-chart"
import { Bar } from "@/components/dither-kit/bar"
import { PieChart } from "@/components/dither-kit/pie-chart"
import { Pie } from "@/components/dither-kit/pie"
import { Grid } from "@/components/dither-kit/grid"
import { XAxis } from "@/components/dither-kit/x-axis"
import { YAxis } from "@/components/dither-kit/y-axis"
import { Tooltip } from "@/components/dither-kit/tooltip"
import { DitherMetricTile } from "@/components/DitherMetricTile"
import { Legend } from "@/components/dither-kit/legend"
import { Sparkline } from "@/components/dither-kit/sparkline"
import type { DitherColor } from "@/components/dither-kit/palette"

interface AnalyticsTabProps {
    serverId: string
}

const POLL_INTERVAL = 30_000
const MAX_CHART_POINTS = 72
const CLIENT_COLORS: DitherColor[] = ["blue", "purple", "green", "orange", "pink", "grey"]


export function AnalyticsTab({ serverId }: AnalyticsTabProps) {
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [noData, setNoData] = useState(false)
    const [serverOffline, setServerOffline] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const lastDataRef = useRef<AnalyticsData | null>(null)
    const requestInFlightRef = useRef(false)

    const loadData = useCallback(async () => {
        if (requestInFlightRef.current) return
        requestInFlightRef.current = true
        try {
            const result = await window.context.getAnalyticsData(serverId)
            if (result.success && result.data) {
                setData(result.data)
                lastDataRef.current = result.data
                setNoData(false)
                setServerOffline(false)
            } else if (result.error === "no-data") {
                if (lastDataRef.current) setServerOffline(true)
                else setNoData(true)
            }
        } catch {
            if (lastDataRef.current) setServerOffline(true)
        } finally {
            requestInFlightRef.current = false
            setLoading(false)
        }
    }, [serverId])

    useEffect(() => {
        void loadData()
        const refreshWhenVisible = () => {
            if (!document.hidden) void loadData()
        }
        document.addEventListener("visibilitychange", refreshWhenVisible)
        const poll = window.setInterval(refreshWhenVisible, POLL_INTERVAL)
        return () => {
            window.clearInterval(poll)
            document.removeEventListener("visibilitychange", refreshWhenVisible)
        }
    }, [loadData])

    if (loading && !data) {
        return (
            <div className="grid min-h-[360px] place-items-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner className="h-4 w-4" />
                    Reading analytics
                </div>
            </div>
        )
    }

    if (noData && !data) {
        return (
            <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-border bg-card">
                <DitherBackdrop />
                <div className="relative z-10 flex min-h-[420px] max-w-lg flex-col justify-end p-8">
                    <div className="mb-5 grid h-10 w-10 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                        <BarChart3 className="h-5 w-5" />
                    </div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                        Analytics is armed
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight">Waiting for the first signal</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Start the server once. Catalyst Analytics will begin filling this workspace with player,
                        performance, and activity data automatically.
                    </p>
                </div>
            </div>
        )
    }

    const displayData = data ?? lastDataRef.current
    if (!displayData) return null

    return (
        <AnalyticsWorkspace
            data={displayData}
            isLive={!serverOffline && !!data}
            serverOffline={serverOffline}
            showSettings={showSettings}
            onToggleSettings={() => setShowSettings((value) => !value)}
        />
    )
}

function AnalyticsWorkspace({
    data,
    isLive,
    serverOffline,
    showSettings,
    onToggleSettings,
}: {
    data: AnalyticsData
    isLive: boolean
    serverOffline: boolean
    showSettings: boolean
    onToggleSettings: () => void
}) {
    const { overview, players } = data
    const timeline = useMemo(() => data.timeline.slice(-MAX_CHART_POINTS), [data.timeline])
    const tps = useMemo(() => data.tps.slice(-MAX_CHART_POINTS), [data.tps])
    const mspt = useMemo(() => data.mspt.slice(-MAX_CHART_POINTS), [data.mspt])
    const memory = useMemo(
        () => data.memory.slice(-MAX_CHART_POINTS).map((point) => ({
            ...point,
            percent: point.maxMB > 0 ? Math.round((point.usedMB / point.maxMB) * 100) : 0,
        })),
        [data.memory],
    )
    const hourlyData = useMemo(
        () => Object.entries(overview.hourlyJoins ?? {})
            .map(([hour, joins]) => ({ hour: hour.padStart(2, "0") + ":00", joins }))
            .sort((a, b) => a.hour.localeCompare(b.hour)),
        [overview.hourlyJoins],
    )
    const clients = useMemo(() => {
        if (data.clients.length) return data.clients.slice(0, 6)
        const counts = new Map<string, number>()
        for (const player of players) {
            const client = normalizeClientBrand(player.clientBrand)
            if (client) counts.set(client, (counts.get(client) ?? 0) + 1)
        }
        return [...counts.entries()]
            .map(([client, count]) => ({ client, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6)
    }, [data.clients, players])
    const clientConfig = useMemo(
        () => Object.fromEntries(clients.map((item, index) => [
            item.client,
            { label: item.client, color: CLIENT_COLORS[index % CLIENT_COLORS.length] },
        ])),
        [clients],
    )
    const memoryLoad = overview.memoryUsedMB && overview.memoryMaxMB
        ? Math.round((overview.memoryUsedMB / overview.memoryMaxMB) * 100)
        : null

    const playerSpark = timeline.map((point) => point.players)
    const tpsSpark = tps.map((point) => point.tps)
    const memorySpark = memory.map((point) => point.percent)
    const msptSpark = mspt.map((point) => point.mspt)

    return (
        <div className="space-y-4 pb-6">
            <header className="flex flex-col gap-3 border-b border-foreground/[0.06] pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                            Intelligence layer
                        </span>
                        {isLive && <Badge variant="outline" className="h-5 border-primary/25 bg-primary/10 px-2 text-[10px] text-primary">Live</Badge>}
                        {serverOffline && (
                            <Badge variant="outline" className="h-5 gap-1 px-2 text-[10px] text-muted-foreground">
                                <ServerOff className="h-3 w-3" />
                                Cached
                            </Badge>
                        )}
                    </div>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight">Server analytics</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Last signal {formatTimestamp(data.lastUpdated)} / {players.length} tracked profiles
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={onToggleSettings} aria-expanded={showSettings}>
                    <Settings className="h-3.5 w-3.5" />
                    Tracking
                </Button>
            </header>

            {showSettings && data.trackingConfig && <TrackingSettings config={data.trackingConfig} />}

            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <DitherMetricTile
                    label="Players now"
                    value={overview.currentOnline}
                    detail={overview.peakOnline + " peak online"}
                    data={playerSpark}
                    color="blue"
                    trendIntent="higher"
                />
                <DitherMetricTile
                    label="Tick rate"
                    value={overview.currentTps?.toFixed(1) ?? "-"}
                    suffix="TPS"
                    detail="20.0 is ideal"
                    data={tpsSpark}
                    color="green"
                    precision={1}
                    trendIntent="higher"
                />
                <DitherMetricTile
                    label="Memory usage"
                    value={memoryLoad ?? "-"}
                    suffix={memoryLoad === null ? undefined : "%"}
                    detail={overview.memoryUsedMB ? Math.round(overview.memoryUsedMB) + " MB in use" : "No signal"}
                    data={memorySpark}
                    color="purple"
                    trendIntent="lower"
                />
                <DitherMetricTile
                    label="Tick time"
                    value={overview.currentMspt?.toFixed(1) ?? "-"}
                    suffix="ms"
                    detail="Lower is better"
                    data={msptSpark}
                    color="orange"
                    precision={1}
                    trendIntent="lower"
                />
            </section>

            <section className="grid overflow-hidden rounded-[14px] bg-card/40 grid-cols-2 xl:grid-cols-4">
                <CompactFact label="Unique players" value={overview.uniquePlayers} detail={overview.newPlayers + " new"} />
                <CompactFact label="Average playtime" value={formatPlayTime(overview.averagePlayTimeSeconds)} detail={overview.returningPlayers + " returning"} />
                <CompactFact label="Total joins" value={overview.totalJoins} detail={overview.currentOnline + " online now"} />
                <CompactFact label="Uptime" value={formatUptime(overview.serverStartTime)} detail={formatTimestamp(data.lastUpdated) + " last signal"} />
            </section>

            <div className="grid gap-4 xl:grid-cols-12">
                <Panel
                    className="xl:col-span-8"
                    eyebrow="Audience"
                    title="Players over time"
                    value={String(overview.currentOnline)}
                    meta="online now"
                >
                    {timeline.length > 1 ? (
                        <AreaChart
                            data={timeline}
                            config={{ players: { label: "Players", color: "blue" } }}
                            className="h-[230px]"
                            bloom="off"
                            animationDuration={650}
                        >
                            <Grid horizontal vertical={false} />
                            <XAxis dataKey="timestamp" tickFormatter={formatAxisTime} maxTicks={6} />
                            <YAxis tickCount={4} />
                            <Area dataKey="players" variant="dotted" />
                            <Tooltip labelKey="timestamp" valueFormatter={(value) => value + " players"} />
                        </AreaChart>
                    ) : <EmptyChart label="Player history will appear after the next samples." />}
                </Panel>

                <Panel className="xl:col-span-4" eyebrow="Live pulse" title="Current server shape">
                    <div className="divide-y divide-foreground/[0.055]">
                        <PulseRow label="Player load" value={overview.currentOnline + " / " + Math.max(overview.peakOnline, overview.currentOnline)} data={playerSpark} color="blue" />
                        <PulseRow label="Tick health" value={(overview.currentTps?.toFixed(1) ?? "-") + " TPS"} data={tpsSpark} color="green" />
                        <PulseRow label="Memory pressure" value={memoryLoad === null ? "-" : memoryLoad + "%"} data={memorySpark} color="purple" />
                        <PulseRow label="MSPT" value={(overview.currentMspt?.toFixed(1) ?? "-") + " ms"} data={mspt.map((point) => point.mspt)} color="orange" />
                    </div>
                </Panel>

                <Panel className="xl:col-span-6" eyebrow="Performance" title="Tick rate" value={overview.currentTps?.toFixed(1) ?? "-"} meta="TPS">
                    {tps.length > 1 ? (
                        <LineChart
                            data={tps}
                            config={{ tps: { label: "TPS", color: "green" } }}
                            className="h-[190px]"
                            bloom="off"
                            animationDuration={600}
                        >
                            <Grid />
                            <XAxis dataKey="timestamp" tickFormatter={formatAxisTime} maxTicks={5} />
                            <YAxis tickCount={4} />
                            <Line dataKey="tps" variant="dotted" />
                            <Tooltip labelKey="timestamp" valueFormatter={(value) => value.toFixed(2) + " TPS"} />
                        </LineChart>
                    ) : <EmptyChart label="TPS history is collecting." />}
                </Panel>

                <Panel className="xl:col-span-6" eyebrow="Resources" title="Memory pressure" value={memoryLoad === null ? "-" : memoryLoad + "%"} meta="heap">
                    {memory.length > 1 ? (
                        <AreaChart
                            data={memory}
                            config={{ percent: { label: "Memory", color: "purple" } }}
                            className="h-[190px]"
                            bloom="off"
                            animationDuration={600}
                        >
                            <Grid />
                            <XAxis dataKey="timestamp" tickFormatter={formatAxisTime} maxTicks={5} />
                            <YAxis tickFormatter={(value) => value + "%"} tickCount={4} />
                            <Area dataKey="percent" variant="hatched" />
                            <Tooltip labelKey="timestamp" valueFormatter={(value) => value + "%"} />
                        </AreaChart>
                    ) : <EmptyChart label="Memory history is collecting." />}
                </Panel>

                <Panel className="xl:col-span-7" eyebrow="Rhythm" title="Join activity by hour" value={String(overview.totalJoins)} meta="total joins">
                    {hourlyData.length ? (
                        <BarChart
                            data={hourlyData}
                            config={{ joins: { label: "Joins", color: "orange" } }}
                            className="h-[220px]"
                            bloom="off"
                            animationDuration={600}
                        >
                            <Grid />
                            <XAxis dataKey="hour" maxTicks={8} />
                            <YAxis tickCount={4} />
                            <Bar dataKey="joins" variant="dotted" />
                            <Tooltip labelKey="hour" valueFormatter={(value) => value + " joins"} />
                        </BarChart>
                    ) : <EmptyChart label="Join distribution needs more sessions." />}
                </Panel>

                <Panel className="xl:col-span-5" eyebrow="Clients" title="Player ecosystem" value={String(clients.length)} meta="client types">
                    {clients.length ? (
                        <div className="grid min-h-[220px] grid-cols-[minmax(0,1fr)_132px] items-center gap-2">
                            <div className="space-y-2">
                                {clients.map((client, index) => (
                                    <div key={client.client} className="flex items-center gap-2 border-b border-foreground/[0.055] pb-2 text-xs last:border-0">
                                        <span className="font-data text-[10px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                                        <span className="min-w-0 flex-1 truncate">{client.client}</span>
                                        <span className="font-data font-medium tabular-nums">{client.count}</span>
                                    </div>
                                ))}
                            </div>
                            <PieChart
                                data={clients}
                                config={clientConfig}
                                dataKey="count"
                                nameKey="client"
                                innerRadius={0.58}
                                className="h-[150px]"
                                bloom="off"
                                animationDuration={650}
                            >
                                <Pie variant="dotted" />
                                <Tooltip valueFormatter={(value) => value + " players"} />
                                <Legend align="center" />
                            </PieChart>
                        </div>
                    ) : <EmptyChart label="Client brands are not available yet." />}
                </Panel>
            </div>

            <section className="grid gap-4 xl:grid-cols-12">
                <Panel className="xl:col-span-8" eyebrow="Players" title="Most active profiles" value={String(players.length)} meta="tracked">
                    {players.length ? (
                        <div className="divide-y divide-border">
                            {[...players]
                                .sort((a, b) => b.totalPlayTimeSeconds - a.totalPlayTimeSeconds)
                                .slice(0, 10)
                                .map((player, index) => (
                                    <div key={player.uuid} className="grid grid-cols-[28px_minmax(0,1fr)_70px_90px] items-center gap-2 py-2 text-xs">
                                        <span className="font-data text-[10px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span className={"h-1.5 w-1.5 rounded-full " + (player.online ? "bg-primary" : "bg-muted-foreground/35")} />
                                            <span className="truncate font-medium">{player.name}</span>
                                        </div>
                                        <span className="truncate text-right text-muted-foreground">{player.clientVersion ?? "-"}</span>
                                        <span className="text-right font-data tabular-nums">{formatPlayTime(player.totalPlayTimeSeconds)}</span>
                                    </div>
                                ))}
                        </div>
                    ) : <EmptyChart label="No player profiles recorded." />}
                </Panel>
                <Panel className="xl:col-span-4" eyebrow="Lifetime" title="Server events">
                    <div className="grid grid-cols-2 border-l border-t border-border">
                        <EventMetric icon={Skull} label="Deaths" value={overview.totalDeaths} />
                        <EventMetric icon={Swords} label="Kills" value={overview.totalKills} />
                        <EventMetric icon={Terminal} label="Commands" value={overview.totalCommandsExecuted} />
                        <EventMetric icon={Gauge} label="Messages" value={overview.totalChatMessages} />
                    </div>
                </Panel>
            </section>
        </div>
    )
}

function Panel({
    eyebrow,
    title,
    value,
    meta,
    className = "",
    children,
}: {
    eyebrow: string
    title: string
    value?: string
    meta?: string
    className?: string
    children: ReactNode
}) {
    return (
        <section className={"overflow-hidden rounded-[14px] border border-foreground/[0.055] bg-card/50 " + className}>
            <div className="flex min-h-[72px] items-start justify-between gap-4 px-4 pt-4">
                <div className="min-w-0">
                    <h3 className="truncate text-[12px] font-medium text-muted-foreground">{title}</h3>
                    {value !== undefined ? (
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="font-data text-[27px] font-medium leading-none tracking-[-0.035em] tabular-nums">{value}</span>
                            {meta && <span className="text-[10px] text-muted-foreground">{meta}</span>}
                        </div>
                    ) : (
                        <p className="mt-1.5 text-[10px] text-muted-foreground/65">{eyebrow}</p>
                    )}
                </div>
                {value !== undefined && (
                    <span className="pt-0.5 text-[10px] text-muted-foreground/65">{eyebrow}</span>
                )}
            </div>
            <div className="px-4 pb-4 pt-1">{children}</div>
        </section>
    )
}

function CompactFact({
    label,
    value,
    detail,
}: {
    label: string
    value: string | number
    detail: string
}) {
    return (
        <div className="min-w-0 border-b border-r border-foreground/[0.055] px-4 py-3 xl:border-b-0">
            <p className="truncate text-[11px] text-muted-foreground">{label}</p>
            <div className="mt-1.5 flex min-w-0 items-baseline gap-2">
                <span className="truncate font-data text-[16px] font-medium tracking-tight tabular-nums">{value}</span>
                <span className="truncate text-[10px] text-muted-foreground/70">{detail}</span>
            </div>
        </div>
    )
}

function PulseRow({ label, value, data, color }: { label: string; value: string; data: number[]; color: DitherColor }) {
    const safeData = data.length > 1 ? data.slice(-32) : [0, 0]
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_104px] items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
                <p className="mt-1 font-data text-sm font-medium tabular-nums">{value}</p>
            </div>
            <Sparkline data={safeData} color={color} variant="dotted" bloom="off" className="h-9" />
        </div>
    )
}

function EventMetric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
    return (
        <div className="min-h-[102px] border-b border-r border-foreground/[0.055] p-4">
            <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] uppercase tracking-[0.12em]">{label}</span>
                <Icon className="h-3.5 w-3.5 text-primary/70" />
            </div>
            <p className="mt-5 font-data text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
        </div>
    )
}

function EmptyChart({ label }: { label: string }) {
    return (
        <div className="relative grid h-[190px] place-items-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/15">
            <DitherBackdrop />
            <p className="relative z-10 max-w-[240px] text-center text-xs leading-5 text-muted-foreground">{label}</p>
        </div>
    )
}

function DitherBackdrop() {
    return (
        <div
            className="pointer-events-none absolute inset-0 opacity-[0.16]"
            style={{
                backgroundImage: "radial-gradient(circle, hsl(var(--primary)) 0.7px, transparent 0.8px)",
                backgroundSize: "7px 7px",
                maskImage: "linear-gradient(to top right, black, transparent 72%)",
            }}
        />
    )
}

function TrackingSettings({ config }: { config: NonNullable<AnalyticsData["trackingConfig"]> }) {
    const settings = [
        ["track-player-joins", "Joins and leaves"],
        ["track-player-versions", "Client versions"],
        ["track-player-clients", "Client brands"],
        ["track-geolocation", "Geolocation"],
        ["track-os", "Operating systems"],
        ["track-tps", "TPS monitoring"],
        ["track-ram", "Memory monitoring"],
        ["track-playtime", "Play time"],
        ["track-fps", "FPS collection"],
    ] as const
    return (
        <section className="rounded-xl border border-border bg-card/70">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-primary">Collection</p>
                    <h3 className="mt-1 text-sm font-medium">Tracking controls</h3>
                </div>
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3">
                {settings.map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between gap-3 border-b border-r border-border px-4 py-3">
                        <span className="text-xs">{label}</span>
                        <Switch checked={config[key]} disabled />
                    </div>
                ))}
            </div>
        </section>
    )
}

function formatPlayTime(seconds: number) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return hours > 0 ? hours + "h " + minutes + "m" : minutes + "m"
}

function formatUptime(startTime?: string) {
    if (!startTime) return "-"
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 1000))
    const hours = Math.floor(seconds / 3600)
    if (hours >= 24) return Math.floor(hours / 24) + "d " + (hours % 24) + "h"
    return hours + "h " + Math.floor((seconds % 3600) / 60) + "m"
}

function formatTimestamp(value: ReactNode) {
    const date = new Date(String(value))
    return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function formatAxisTime(value: unknown) {
    return formatTimestamp(String(value))
}

function normalizeClientBrand(brand?: string): string | null {
    if (!brand) return null
    const value = brand.toLowerCase().trim()
    if (value.includes("lunar")) return "Lunar Client"
    if (value.includes("badlion") || value.includes("blc")) return "Badlion Client"
    if (value.includes("fabric")) return "Fabric"
    if (value.includes("forge") || value.includes("fml")) return "Forge"
    if (value.includes("quilt")) return "Quilt"
    if (value.includes("labymod")) return "LabyMod"
    if (value.includes("feather")) return "Feather"
    if (value === "vanilla" || value === "minecraft" || value === "brand") return "Vanilla"
    return brand
}
