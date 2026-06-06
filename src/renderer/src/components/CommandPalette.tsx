import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command'
import { Dialog, DialogContent } from './ui/dialog'
import { useServerStore } from '../stores/serverStore'
import { usePreferences } from '../hooks/usePreferences'
import { Search, Play, Square, RotateCw, Settings, Zap } from 'lucide-react'

interface CommandAction {
  id: string
  label: string
  icon: React.ReactNode
  action: () => void | Promise<void>
  group: string
  keywords?: string[]
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const { servers, startServer, stopServer, restartServer } = useServerStore()
  usePreferences() // preferences removed as it was unused

  // Global keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Build command actions
  const buildActions = useCallback((): CommandAction[] => {
    const actions: CommandAction[] = [
      // Navigation actions
      {
        id: 'nav-servers',
        label: 'Go to Servers',
        icon: <Zap className="w-4 h-4" />,
        action: () => {
          navigate('/servers')
          setOpen(false)
        },
        group: 'Navigation',
        keywords: ['servers', 'manage', 'dashboard']
      },
      {
        id: 'nav-settings',
        label: 'Go to Settings',
        icon: <Settings className="w-4 h-4" />,
        action: () => {
          navigate('/settings')
          setOpen(false)
        },
        group: 'Navigation',
        keywords: ['settings', 'preferences', 'config']
      },
      {
        id: 'nav-analytics',
        label: 'Go to Analytics',
        icon: <Zap className="w-4 h-4" />,
        action: () => {
          navigate('/analytics')
          setOpen(false)
        },
        group: 'Navigation',
        keywords: ['analytics', 'dashboard', 'stats']
      },
      // Server actions
      ...servers.flatMap((server) => [
        {
          id: `start-${server.id}`,
          label: `Start ${server.name}`,
          icon: <Play className="w-4 h-4" />,
          action: async () => {
            await startServer(server.id)
            setOpen(false)
          },
          group: 'Servers',
          keywords: [server.name.toLowerCase(), 'start', 'run']
        },
        {
          id: `stop-${server.id}`,
          label: `Stop ${server.name}`,
          icon: <Square className="w-4 h-4" />,
          action: async () => {
            await stopServer(server.id)
            setOpen(false)
          },
          group: 'Servers',
          keywords: [server.name.toLowerCase(), 'stop', 'kill']
        },
        {
          id: `restart-${server.id}`,
          label: `Restart ${server.name}`,
          icon: <RotateCw className="w-4 h-4" />,
          action: async () => {
            await restartServer(server.id)
            setOpen(false)
          },
          group: 'Servers',
          keywords: [server.name.toLowerCase(), 'restart', 'reboot']
        }
      ])
    ]
    return actions
  }, [servers, startServer, stopServer, restartServer, navigate])

  const actions = buildActions()

  // Fuzzy search filter
  const filteredActions = search
    ? actions.filter((action) => {
        const query = search.toLowerCase()
        const matchesLabel = action.label.toLowerCase().includes(query)
        const matchesKeywords = action.keywords?.some((kw) =>
          kw.toLowerCase().includes(query)
        )
        return matchesLabel || matchesKeywords
      })
    : actions

  // Group actions by category
  const groupedActions = filteredActions.reduce(
    (groups, action) => {
      if (!groups[action.group]) {
        groups[action.group] = []
      }
      groups[action.group].push(action)
      return groups
    },
    {} as Record<string, CommandAction[]>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <Command className="[&_[cmdk-input-wrapper]_svg]:hidden [&_[cmdk-input]]:border-0 [&_[cmdk-input]]:focus-visible:ring-0">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Search servers, actions, or navigate..."
              value={search}
              onValueChange={setSearch}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty className="py-6 text-center text-sm">
              No results found.
            </CommandEmpty>
            {Object.entries(groupedActions).map(([group, groupActions]) => (
              <CommandGroup key={group} heading={group} className="overflow-hidden px-2 py-1.5">
                {groupActions.map((action) => (
                  <CommandItem
                    key={action.id}
                    value={action.label}
                    onSelect={action.action}
                    className="cursor-pointer"
                  >
                    <div className="mr-2 flex h-4 w-4 items-center justify-center">
                      {action.icon}
                    </div>
                    <span className="flex-1">{action.label}</span>
                    {action.group === 'Servers' && (
                      <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                        Ctrl+K
                      </kbd>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          <div className="border-t px-3 py-2 text-xs text-muted-foreground">
            <p>
              <kbd className="rounded border bg-muted px-1">Ctrl</kbd>
              <span className="mx-1">+</span>
              <kbd className="rounded border bg-muted px-1">K</kbd>
              <span className="ml-2">to toggle</span>
            </p>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
