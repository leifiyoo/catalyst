import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Activity } from 'lucide-react'
import { AnalyticsTab } from '@/components/AnalyticsTab'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useServerStore } from '@/stores/serverStore'

export function AnalyticsPage() {
  const { servers, loaded } = useServerStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Default to the first running server, otherwise the first server
  useEffect(() => {
    if (!selectedId && servers.length > 0) {
      const running = servers.find((server) => server.status === 'Online')
      setSelectedId((running ?? servers[0]).id)
    }
  }, [servers, selectedId])

  if (!loaded) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="h-5 w-5 text-muted-foreground" />
      </div>
    )
  }

  if (servers.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-8">
        <div className="flex max-w-sm flex-col items-center text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-card text-muted-foreground">
            <Activity className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-lg font-semibold tracking-tight">No analytics yet</h1>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">
            Create a server to start collecting player and performance analytics.
          </p>
        </div>
      </div>
    )
  }

  const selectedServer = servers.find((server) => server.id === selectedId)

  return (
    <motion.div
      initial={false}
      className="mx-auto w-full max-w-[1200px] px-8 pb-10 pt-7"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Analytics</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Player activity and performance metrics per server
          </p>
        </div>
        <Select value={selectedId ?? undefined} onValueChange={setSelectedId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select a server" />
          </SelectTrigger>
          <SelectContent>
            {servers.map((server) => (
              <SelectItem key={server.id} value={server.id}>
                <span className="flex items-center gap-2">
                  <span
                    className={`status-dot ${
                      server.status === 'Online'
                        ? 'status-dot-online'
                        : server.status === 'Starting'
                          ? 'status-dot-starting'
                          : server.status === 'Stopping'
                            ? 'status-dot-stopping'
                            : 'status-dot-offline'
                    }`}
                  />
                  {server.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 min-h-[520px]">
        {selectedServer ? (
          <AnalyticsTab key={selectedServer.id} serverId={selectedServer.id} />
        ) : null}
      </div>
    </motion.div>
  )
}
