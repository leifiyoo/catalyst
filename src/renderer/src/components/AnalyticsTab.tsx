import { lazy, Suspense } from "react"
import { Spinner } from "@/components/ui/spinner"

const AnalyticsTabContent = lazy(() =>
    import("@/components/AnalyticsTabContent").then((mod) => ({
        default: mod.AnalyticsTab,
    }))
)

interface AnalyticsTabProps {
    serverId: string
}

/**
 * Lazy-loaded wrapper for the Analytics tab.
 * recharts (~300KB) is only loaded when the user actually opens this tab.
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
            <AnalyticsTabContent serverId={serverId} />
        </Suspense>
    )
}
