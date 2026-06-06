import { AnalyticsDashboard } from '../components/AnalyticsDashboard'

export function AnalyticsPage() {
  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Real-time server performance metrics and historical trends
        </p>
      </div>

      <AnalyticsDashboard />
    </div>
  )
}
