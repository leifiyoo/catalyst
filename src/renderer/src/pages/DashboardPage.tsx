import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "motion/react"
import {
    Activity,
    ArrowUpRight,
    ChevronRight,
    Play,
    Plus,
    Server,
    Square,
} from "lucide-react"
import type { ServerRecord, ServerStats } from "@shared/types"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { RadialGauge } from "@/components/ui/radial-gauge"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { useServerStore, type ServerEvent } from "@/stores/serverStore"
import catalystIcon from "../../../../resources/icon.png"

const DASHBOARD_EASE = [0.22, 1, 0.36, 1] as const

const dashboardSequence = {
    hidden: {},
    show: {
        transition: {
            staggerChildren: 0.025,
            delayChildren: 0.02,
        },
    },
}

const dashboardItem = {
    hidden: { opacity: 0, y: 8 },
    show: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.22,
            ease: DASHBOARD_EASE,
        },
    },
}

function parsePlayers(value: string | undefined) {
    const match = value?.match(/(\d+)\s*\/\s*(\d+)/)
    return {
        current: match ? Number(match[1]) : 0,
        max: match ? Number(match[2]) : 0,
    }
}

function formatRam(mb: number) {
    if (mb >= 1024) {
        const gb = mb / 1024
        return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`
    }
    return `${mb} MB`
}

function timeAgo(timestamp: number) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return "just now"
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
}

function HeroStat({
    label,
    value,
    format,
    active,
}: {
    label: string
    value: number
    format?: (v: number) => string
    active?: boolean
}) {
    return (
        <div className="min-w-[110px]">
            <div className="text-[12.5px] text-muted-foreground">{label}</div>
            <div className="mt-1 flex items-start gap-0.5">
                <AnimatedNumber
                    value={value}
                    format={format}
                    className={`font-data text-[34px] font-medium leading-none tracking-tight ${
                        active ? "text-primary" : "text-foreground"
                    }`}
                />
                <ArrowUpRight
                    className={`mt-0.5 h-4 w-4 ${active ? "text-primary" : "text-muted-foreground/50"}`}
                    strokeWidth={2.4}
                />
            </div>
        </div>
    )
}

function ServerRow({ server, stats }: { server: ServerRecord; stats?: ServerStats }) {
    const navigate = useNavigate()
    const { stopServer } = useServerStore()
    const online = server.status === "Online"
    const busy = server.status === "Starting" || server.status === "Stopping"

    const players = online
        ? stats
            ? { current: stats.playerCount, max: stats.maxPlayers }
            : parsePlayers(server.players)
        : { current: 0, max: 0 }

    const memUsed = online ? (stats?.memoryUsedMB ?? null) : null
    const memMax = stats?.memoryMaxMB ?? server.ramMB
    const memPercent = memUsed !== null && memMax > 0 ? Math.min(100, (memUsed / memMax) * 100) : 0
    const tps = online ? (stats?.tps ?? null) : null

    const handleToggle = (event: React.MouseEvent) => {
        event.stopPropagation()
        if (busy) return
        if (online) {
            stopServer(server.id)
        } else {
            navigate(`/servers/${server.id}?start=true`)
        }
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/servers/${server.id}`)}
            onKeyDown={(e) => {
                if (e.key === "Enter") navigate(`/servers/${server.id}`)
            }}
            className="group grid cursor-pointer grid-cols-[minmax(170px,1.4fr)_minmax(86px,0.7fr)_minmax(76px,0.55fr)_minmax(130px,1fr)_minmax(60px,0.45fr)_40px] items-center gap-3 border-t border-border px-6 py-4 text-left transition-colors duration-200 hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40"
        >
            <div className="flex min-w-0 items-center gap-3">
                <span className={`status-dot ${
                    online
                        ? "status-dot-online"
                        : server.status === "Starting"
                          ? "status-dot-starting"
                          : server.status === "Stopping"
                            ? "status-dot-stopping"
                            : "status-dot-offline"
                }`} />
                <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium text-foreground">{server.name}</div>
                    <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
                        {server.framework} {server.version}
                    </div>
                </div>
            </div>

            <div className={`text-[12.5px] font-medium ${
                online
                    ? "text-primary"
                    : server.status === "Starting"
                      ? "text-yellow-300"
                      : server.status === "Stopping"
                        ? "text-orange-300"
                        : "text-muted-foreground"
            }`}>
                {server.status === "Idle" ? "Offline" : server.status}
            </div>

            <div className="font-data text-[12.5px] text-foreground">
                {online ? `${players.current}${players.max ? ` / ${players.max}` : ""}` : "—"}
            </div>

            <div>
                {memUsed !== null ? (
                    <>
                        <div className="font-data text-[12px] text-foreground">
                            {formatRam(Math.round(memUsed))} / {formatRam(memMax)}
                        </div>
                        <div className="mt-1.5 h-1 w-full max-w-[110px] overflow-hidden rounded-full bg-muted">
                            <motion.div
                                className="h-full rounded-full bg-primary"
                                animate={{ width: `${memPercent}%` }}
                                transition={{ type: "spring", stiffness: 80, damping: 22 }}
                            />
                        </div>
                    </>
                ) : (
                    <span className="font-data text-[12px] text-muted-foreground">{formatRam(server.ramMB)} alloc</span>
                )}
            </div>

            <div className="font-data text-[12.5px]">
                {tps !== null ? (
                    <span className={tps >= 18 ? "text-primary" : tps >= 14 ? "text-[hsl(var(--chart-3))]" : "text-destructive"}>
                        {tps.toFixed(1)}
                    </span>
                ) : (
                    <span className="text-muted-foreground">—</span>
                )}
            </div>

            <button
                type="button"
                onClick={handleToggle}
                aria-label={online ? `Stop ${server.name}` : `Start ${server.name}`}
                disabled={busy}
                className={`grid h-8 w-8 place-items-center rounded-full border transition-all duration-200 ${
                    online
                        ? "border-border text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                        : busy
                          ? "cursor-default border-border text-muted-foreground opacity-60"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                }`}
            >
                {busy ? <Spinner className="h-3.5 w-3.5" /> : online ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
        </div>
    )
}

function formatServerEventStatus(status: ServerRecord["status"]) {
    if (status === "Starting") return "starting"
    if (status === "Online") return "started"
    if (status === "Stopping") return "stopping"
    return "stopped"
}

function ActivityFeed({ events }: { events: ServerEvent[] }) {
    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 py-7 text-center">
                <Activity className="h-5 w-5 text-muted-foreground/50" />
                <p className="text-[12.5px] text-muted-foreground">
                    No activity yet this session.
                    <br />
                    Server starts and stops will show up here.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-0.5">
            {events.slice(0, 5).map((event) => (
                <div
                    key={`${event.serverId}-${event.at}`}
                    className="flex items-center gap-2.5 rounded-xl px-2 py-2"
                >
                    <span className={`status-dot ${
                        event.status === "Online"
                            ? "status-dot-online"
                            : event.status === "Starting"
                              ? "status-dot-starting"
                              : event.status === "Stopping"
                                ? "status-dot-stopping"
                                : "status-dot-offline"
                    }`} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                        <span className="font-medium">{event.serverName}</span>{" "}
                        <span className="text-muted-foreground">{formatServerEventStatus(event.status)}</span>
                    </span>
                    <span className="font-data shrink-0 text-[11.5px] text-muted-foreground">{timeAgo(event.at)}</span>
                </div>
            ))}
        </div>
    )
}

export function DashboardPage() {
    const navigate = useNavigate()
    const { servers, loaded, stats, events } = useServerStore()

    const runningServers = servers.filter((server) => server.status === "Online")

    const totalPlayers = useMemo(
        () =>
            runningServers.reduce((sum, server) => {
                const liveStats = stats[server.id]
                if (liveStats) return sum + liveStats.playerCount
                return sum + parsePlayers(server.players).current
            }, 0),
        [runningServers, stats]
    )

    const memTotals = runningServers.reduce(
        (acc, server) => {
            const liveStats = stats[server.id]
            acc.used += liveStats?.memoryUsedMB ?? 0
            acc.max += liveStats?.memoryMaxMB ?? server.ramMB
            return acc
        },
        { used: 0, max: 0 }
    )
    const memPercent = memTotals.max > 0 ? (memTotals.used / memTotals.max) * 100 : 0

    const tpsValues = runningServers
        .map((server) => stats[server.id]?.tps)
        .filter((tps): tps is number => tps != null)
    const avgTps = tpsValues.length > 0 ? tpsValues.reduce((a, b) => a + b, 0) / tpsValues.length : null

    if (!loaded) {
        return (
            <div className="flex min-h-[calc(100vh-60px)] flex-1 items-center justify-center">
                <Spinner className="h-5 w-5 text-muted-foreground" />
            </div>
        )
    }

    if (servers.length === 0) {
        return (
            <motion.div
                className="mx-auto grid min-h-[calc(100vh-60px)] w-full max-w-[980px] items-center gap-8 px-8 pb-12 lg:grid-cols-[1.05fr_0.95fr]"
                variants={dashboardSequence}
                initial="hidden"
                animate="show"
            >
                <motion.div variants={dashboardItem}>
                    <div className="grid h-16 w-16 place-items-center rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/15 to-card shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                        <img src={catalystIcon} alt="Catalyst" className="h-10 w-10 object-contain" />
                    </div>
                    <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Your server workspace</p>
                    <h1 className="mt-2 max-w-md text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-foreground">Launch your first world with a clear setup.</h1>
                    <p className="mt-4 max-w-md text-[14px] leading-7 text-muted-foreground">Catalyst prepares the runtime, memory and analytics. You stay in control of every setting.</p>
                    <div className="mt-7 flex flex-wrap gap-3">
                        <Button onClick={() => navigate("/servers?create=true")}><Plus className="h-4 w-4" />Create server</Button>
                        <Button variant="outline" onClick={() => navigate("/servers")}><Server className="h-4 w-4" />Import existing</Button>
                    </div>
                </motion.div>
                <motion.div variants={dashboardItem} className="rounded-3xl border border-border bg-card p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_50px_rgba(0,0,0,0.10)]">
                    <div className="px-3 pb-3 pt-2">
                        <p className="text-[12px] font-semibold text-foreground">Getting started</p>
                        <p className="mt-1 text-[11.5px] text-muted-foreground">Three steps from empty workspace to online server.</p>
                    </div>
                    {[
                        { icon: Server, step: "01", title: "Choose your runtime", detail: "Paper, Purpur, Fabric or Vanilla" },
                        { icon: Square, step: "02", title: "Review resources", detail: "Set memory and optional analytics" },
                        { icon: Play, step: "03", title: "Start and monitor", detail: "Console, players and health in one place" },
                    ].map((item, index) => (
                        <motion.div key={item.step} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 + index * 0.06 }} className="flex items-center gap-3 border-t border-border px-3 py-4">
                            <div className="grid h-9 w-9 place-items-center rounded-xl border border-primary/15 bg-primary/10 text-primary"><item.icon className="h-4 w-4" /></div>
                            <div className="min-w-0 flex-1"><p className="text-[12.5px] font-medium text-foreground">{item.title}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{item.detail}</p></div>
                            <span className="font-data text-[10.5px] text-muted-foreground">{item.step}</span>
                        </motion.div>
                    ))}
                </motion.div>
            </motion.div>
        )
    }

    return (
        <motion.div
            className="mx-auto w-full max-w-[1240px] px-8 pb-10 pt-8"
            variants={dashboardSequence}
            initial="hidden"
            animate="show"
        >
            {/* Hero row — greeting left, big live numbers right */}
            <motion.div
                className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6"
                variants={dashboardItem}
            >
                <div>
                    <h1 className="text-[34px] font-medium leading-none tracking-tight text-foreground">Dashboard</h1>
                    <p className="mt-2.5 text-[14px] text-muted-foreground">
                        {runningServers.length > 0
                            ? `${runningServers.length} of ${servers.length} servers running — all systems good.`
                            : "All servers are stopped. Start one to get going."}
                    </p>
                </div>

                <motion.div className="flex flex-wrap items-end gap-x-10 gap-y-4" variants={dashboardSequence}>
                    <motion.div variants={dashboardItem}>
                        <HeroStat label="Servers" value={servers.length} />
                    </motion.div>
                    <motion.div variants={dashboardItem}>
                        <HeroStat label="Running" value={runningServers.length} active={runningServers.length > 0} />
                    </motion.div>
                    <motion.div variants={dashboardItem}>
                        <HeroStat label="Players online" value={totalPlayers} active={totalPlayers > 0} />
                    </motion.div>
                    <motion.div variants={dashboardItem}>
                        <HeroStat
                            label="Memory in use"
                            value={memTotals.used}
                            format={(v) => (v >= 1024 ? `${(v / 1024).toFixed(1)}` : `${Math.round(v)}`)}
                            active={memTotals.used > 0}
                        />
                    </motion.div>
                </motion.div>
            </motion.div>

            {/* Bento grid */}
            <motion.div
                className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]"
                variants={dashboardSequence}
            >
                {/* Servers — wide card */}
                <motion.section
                    className="overflow-hidden rounded-2xl border border-border bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    variants={dashboardItem}
                >
                    <div className="flex items-center justify-between px-6 pb-2 pt-6">
                        <h2 className="text-[16px] font-medium text-foreground">Servers</h2>
                        <button
                            type="button"
                            onClick={() => navigate("/servers")}
                            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
                        >
                            View all
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <div className="grid grid-cols-[minmax(170px,1.4fr)_minmax(86px,0.7fr)_minmax(76px,0.55fr)_minmax(130px,1fr)_minmax(60px,0.45fr)_40px] gap-3 px-6 pb-3 pt-2 text-[11.5px] text-muted-foreground">
                        <span>Server</span>
                        <span>Status</span>
                        <span>Players</span>
                        <span>Memory</span>
                        <span>TPS</span>
                        <span />
                    </div>
                    <div>
                        {servers.slice(0, 6).map((server) => (
                            <ServerRow key={server.id} server={server} stats={stats[server.id]} />
                        ))}
                    </div>
                </motion.section>

                {/* Right column */}
                <motion.div className="flex flex-col gap-5" variants={dashboardSequence}>
                    {/* Live performance gauge */}
                    <motion.section
                        className="rounded-2xl border border-border bg-card px-6 pb-5 pt-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                        variants={dashboardItem}
                    >
                        <h2 className="text-[16px] font-medium text-foreground">Live performance</h2>
                        <div className="mt-1 flex justify-center">
                            <RadialGauge
                                key={runningServers.length > 0 ? "live" : "idle"}
                                value={memPercent}
                                label={runningServers.length > 0 ? "Memory in use" : "No servers running"}
                                display={runningServers.length > 0 ? undefined : "—"}
                                size={190}
                            />
                        </div>
                        <div className="mt-1 flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                            <span className="text-[12.5px] text-muted-foreground">Avg. TPS</span>
                            <span className={`font-data text-[14px] font-medium ${avgTps != null && avgTps >= 18 ? "text-primary" : avgTps != null ? "text-[hsl(var(--chart-3))]" : "text-muted-foreground"}`}>
                                {avgTps != null ? avgTps.toFixed(1) : "—"}
                            </span>
                        </div>
                    </motion.section>

                    {/* Action pair — one lime, one violet */}
                    <motion.div className="grid grid-cols-2 gap-4" variants={dashboardItem}>
                        <button
                            type="button"
                            onClick={() => navigate("/servers?create=true")}
                            className="group flex h-[120px] flex-col justify-between rounded-2xl bg-primary p-4 text-left text-primary-foreground active:scale-[0.99]"
                        >
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-black/10">
                                <Plus className="h-4 w-4" />
                            </span>
                            <span className="text-[14px] font-medium leading-tight">
                                New
                                <br />
                                server
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate("/analytics")}
                            className="group flex h-[120px] flex-col justify-between rounded-2xl bg-[hsl(var(--chart-2))] p-4 text-left text-white active:scale-[0.99]"
                        >
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15">
                                <Activity className="h-4 w-4" />
                            </span>
                            <span className="text-[14px] font-medium leading-tight">
                                Player
                                <br />
                                analytics
                            </span>
                        </button>
                    </motion.div>

                    {/* Activity */}
                    <motion.section
                        className="rounded-2xl border border-border bg-card px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                        variants={dashboardItem}
                    >
                        <h2 className="px-1 text-[16px] font-medium text-foreground">Activity</h2>
                        <div className="mt-2">
                            <ActivityFeed events={events} />
                        </div>
                    </motion.section>
                </motion.div>
            </motion.div>
        </motion.div>
    )
}
