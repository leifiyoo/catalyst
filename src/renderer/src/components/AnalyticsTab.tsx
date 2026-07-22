import { lazy, Suspense } from "react"
import { Spinner } from "@/components/ui/spinner"

const AnalyticsTabContent = lazy(() =>
    import("@/components/DitherAnalyticsTab").then((mod) => ({
        default: mod.AnalyticsTab,
    }))
)

interface AnalyticsTabProps {
    serverId: string
}

/**
 * Lazy-loaded wrapper for the Analytics tab.
 * The canvas-heavy Dither Kit workspace is loaded only when analytics is opened.
 */
export function AnalyticsTab({ serverId }: AnalyticsTabProps) {
    return (
        <Suspense
            fallback={
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Spinner className="text-primary h-6 w-6" />
                    <span className="text-muted-foreground text-sm">Loading analytics...</span>
                </div>
            }
        >
            <AnalyticsTabContent key={serverId} serverId={serverId} />
        </Suspense>
    )
}
