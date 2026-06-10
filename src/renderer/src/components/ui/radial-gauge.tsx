interface RadialGaugeProps {
    /** 0..100 */
    value: number
    label?: string
    /** Center headline, defaults to `${Math.round(value)}%` */
    display?: string
    size?: number
    segments?: number
    className?: string
}

/**
 * Segmented radial gauge — a 270° arc of rounded ticks where the
 * active portion lights up in the accent color.
 */
export function RadialGauge({
    value,
    label,
    display,
    size = 180,
    segments = 28,
    className = "",
}: RadialGaugeProps) {
    const clamped = Math.min(100, Math.max(0, value))
    const activeCount = Math.round((clamped / 100) * segments)

    const startAngle = 135
    const sweep = 270
    const center = size / 2
    const outer = size / 2 - 4
    const inner = outer - size * 0.14

    const ticks = Array.from({ length: segments }, (_, i) => {
        const angle = ((startAngle + (sweep / (segments - 1)) * i) * Math.PI) / 180
        return {
            x1: center + inner * Math.cos(angle),
            y1: center + inner * Math.sin(angle),
            x2: center + outer * Math.cos(angle),
            y2: center + outer * Math.sin(angle),
            active: i < activeCount,
        }
    })

    return (
        <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {ticks.map((tick, i) => (
                    <line
                        key={i}
                        x1={tick.x1}
                        y1={tick.y1}
                        x2={tick.x2}
                        y2={tick.y2}
                        strokeWidth={size * 0.038}
                        strokeLinecap="round"
                        stroke={tick.active ? "hsl(var(--primary))" : "hsl(var(--muted))"}
                        opacity={1}
                    />
                ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div
                    className="font-data font-medium tracking-tight text-foreground"
                    style={{ fontSize: Math.max(16, size * 0.14) }}
                >
                    {display ?? `${Math.round(clamped)}%`}
                </div>
                {label && (
                    <div
                        className="mt-0.5 max-w-[70%] leading-tight text-muted-foreground"
                        style={{ fontSize: Math.max(9.5, size * 0.06) }}
                    >
                        {label}
                    </div>
                )}
            </div>
        </div>
    )
}
