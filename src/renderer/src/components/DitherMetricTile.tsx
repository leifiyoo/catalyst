import { ArrowDown, ArrowUp, Minus } from "lucide-react"
import { Sparkline } from "@/components/dither-kit/sparkline"
import type { DitherColor } from "@/components/dither-kit/palette"

type TrendIntent = "higher" | "lower" | "neutral"

type DitherMetricTileProps = {
    label: string
    value: string | number
    suffix?: string
    detail?: string
    data: number[]
    color?: DitherColor
    showChart?: boolean
    precision?: number
    trendIntent?: TrendIntent
    className?: string
}

export function DitherMetricTile({
    label,
    value,
    suffix,
    detail,
    data,
    color = "blue",
    showChart = true,
    precision = 0,
    trendIntent = "higher",
    className = "",
}: DitherMetricTileProps) {
    const samples = data.filter(Number.isFinite).slice(-36)
    const chartData = samples.length > 1
        ? samples
        : samples.length === 1
            ? [samples[0], samples[0]]
            : [0, 0]
    const comparisonIndex = Math.max(0, chartData.length - 12)
    const delta = chartData[chartData.length - 1] - chartData[comparisonIndex]
    const changeThreshold = precision === 0 ? 0.5 : 0.05
    const hasVariation = samples.length >= 3
        && samples.some((sample) => Math.abs(sample - samples[0]) >= changeThreshold)
    const shouldRenderChart = showChart && hasVariation
    const hasTrend = samples.length >= 4 && Math.abs(delta) >= changeThreshold
    const improving = trendIntent === "neutral"
        ? null
        : trendIntent === "higher"
            ? delta > 0
            : delta < 0
    const TrendIcon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus
    const trendClass = improving === null
        ? "text-muted-foreground"
        : improving
            ? "text-emerald-400"
            : "text-destructive"

    return (
        <section
            className={
                "relative isolate h-[146px] overflow-hidden rounded-[14px] border border-foreground/[0.055] bg-card/55 " +
                className
            }
        >
            <div className="relative z-[2] px-4 pt-4">
                <p className="truncate text-[12px] font-medium text-muted-foreground">
                    {label}
                </p>
                <div className="mt-2 flex min-w-0 items-baseline gap-2">
                    <span className="truncate font-data text-[29px] font-medium leading-none tracking-[-0.035em] text-foreground tabular-nums">
                        {value}
                    </span>
                    {suffix && (
                        <span className="font-data text-[11px] text-muted-foreground">
                            {suffix}
                        </span>
                    )}
                    {hasTrend && (
                        <span className={"inline-flex shrink-0 items-center gap-0.5 font-data text-[11px] font-medium tabular-nums " + trendClass}>
                            <TrendIcon className="h-3 w-3" strokeWidth={2.25} />
                            {Math.abs(delta).toFixed(precision)}
                        </span>
                    )}
                </div>
                {detail && (
                    <p className="mt-1.5 truncate text-[10px] text-muted-foreground">
                        {detail}
                    </p>
                )}
            </div>

            {shouldRenderChart && (
                <div className="pointer-events-none absolute inset-x-[-1px] bottom-[-1px] z-0 h-[52px] opacity-90">
                    <Sparkline
                        data={chartData}
                        color={color}
                        variant="dotted"
                        bloom="off"
                        animate={false}
                        className="h-full w-full"
                    />
                </div>
            )}
        </section>
    )
}
