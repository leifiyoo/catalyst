import { useState, useCallback } from 'react'
import { Checkbox } from './ui/checkbox'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import { useServerStore, Server } from '../stores/serverStore'
import { Play, Square, RotateCw, Download, MoreVertical, Trash2 } from 'lucide-react'

interface ServerMultiSelectProps {
  servers: Server[]
}

export function ServerMultiSelect({ servers }: ServerMultiSelectProps) {
  const [selectedServers, setSelectedServers] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const { startServer, stopServer, restartServer } = useServerStore()

  const toggleServer = useCallback((serverId: string) => {
    setSelectedServers((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(serverId)) {
        newSet.delete(serverId)
      } else {
        newSet.add(serverId)
      }
      
      // Sync selectAll checkbox when individual servers are deselected
      if (newSet.size !== servers.length) {
        setSelectAll(false)
      } else if (newSet.size === servers.length && servers.length > 0) {
        setSelectAll(true)
      }
      
      return newSet
    })
  }, [servers.length])

  const toggleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedServers(new Set())
      setSelectAll(false)
    } else {
      setSelectedServers(new Set(servers.map((s) => s.id)))
      setSelectAll(true)
    }
  }, [servers, selectAll])

  const bulkStart = useCallback(async () => {
    const selectedIds = Array.from(selectedServers)
    await Promise.all(selectedIds.map((id) => startServer(id)))
    setSelectedServers(new Set())
    setSelectAll(false)
  }, [selectedServers, startServer])

  const bulkStop = useCallback(async () => {
    const selectedIds = Array.from(selectedServers)
    await Promise.all(selectedIds.map((id) => stopServer(id)))
    setSelectedServers(new Set())
    setSelectAll(false)
  }, [selectedServers, stopServer])

  const bulkRestart = useCallback(async () => {
    const selectedIds = Array.from(selectedServers)
    await Promise.all(selectedIds.map((id) => restartServer(id)))
    setSelectedServers(new Set())
    setSelectAll(false)
  }, [selectedServers, restartServer])

  const bulkBackup = useCallback(async () => {
    const selectedIds = Array.from(selectedServers)
    // Implement backup logic
    console.log('Backing up servers:', selectedIds)
    // This would call the backup function from your server store
  }, [selectedServers])

  const isAnySelected = selectedServers.size > 0

  return (
    <div className="space-y-4">
      {isAnySelected && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
          <span className="flex-1 text-sm font-medium">
            {selectedServers.size} server{selectedServers.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={bulkStart}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Start All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={bulkStop}
              className="gap-2"
            >
              <Square className="h-4 w-4" />
              Stop All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={bulkRestart}
              className="gap-2"
            >
              <RotateCw className="h-4 w-4" />
              Restart All
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={bulkBackup} className="gap-2">
                  <Download className="h-4 w-4" />
                  Backup All
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedServers(new Set())
                    setSelectAll(false)
                  }}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Selection
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {servers.length > 0 && (
          <div className="flex items-center gap-2 rounded border p-2">
            <Checkbox
              id="select-all"
              checked={selectAll && servers.length > 0}
              onCheckedChange={toggleSelectAll}
              aria-label="Select all servers"
            />
            <label
              htmlFor="select-all"
              className="flex-1 text-sm font-medium cursor-pointer"
            >
              Select All
            </label>
          </div>
        )}

        {servers.map((server) => (
          <div
            key={server.id}
            className={`flex items-center gap-2 rounded border p-2 cursor-pointer transition-colors ${
              selectedServers.has(server.id)
                ? 'bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-700'
                : 'hover:bg-accent'
            }`}
            onClick={() => toggleServer(server.id)}
          >
            <Checkbox
              checked={selectedServers.has(server.id)}
              onCheckedChange={() => toggleServer(server.id)}
              aria-label={`Select ${server.name}`}
            />
            <div className="flex-1">
              <div className="font-medium text-sm">{server.name}</div>
              <div className="text-xs text-muted-foreground">
                {server.online ? 'Online' : 'Offline'} • {server.players || 0} players
              </div>
            </div>
            <div className="h-2 w-2 rounded-full" 
              style={{
                backgroundColor: server.online ? '#10b981' : '#6b7280'
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
