import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command'
import { Dialog, DialogContent } from './ui/dialog'
import { DialogTitle } from '@radix-ui/react-dialog'
import { useServerStore } from '../stores/serverStore'
import { Search, Play, Square, RotateCw, Settings, LayoutGrid, Server, Activity, Plus, Bot } from 'lucide-react'

interface CommandAction {
  id: string
  label: string
  icon: React.ReactNode
  action: () => void | Promise<void>
  group: string
  keywords?: string[]
}

export function CommandPalette({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const { servers, startServer, stopServer, restartServer } = useServerStore()

  // Global shortcut + header button event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    const handleOpenEvent = () => setOpen(true)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('catalyst:command-palette', handleOpenEvent)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('catalyst:command-palette', handleOpenEvent)
    }
  }, [])

  // Clear stale search whenever the palette is opened
  useEffect(() => {
    if (open) setSearch('')
  }, [open])

  const actions = useMemo<CommandAction[]>(() => {
    const close = () => setOpen(false)

    return [
      {
        id: 'nav-dashboard',
        label: 'Go to Dashboard',
        icon: <LayoutGrid className="w-4 h-4" />,
        action: () => {
          navigate('/')
          close()
        },
        group: 'Navigation',
        keywords: ['dashboard', 'home', 'overview'],
      },
      {
        id: 'nav-servers',
        label: 'Go to Servers',
        icon: <Server className="w-4 h-4" />,
        action: () => {
          navigate('/servers')
          close()
        },
        group: 'Navigation',
        keywords: ['servers', 'manage', 'list'],
      },
      {
        id: 'nav-analytics',
        label: 'Go to Analytics',
        icon: <Activity className="w-4 h-4" />,
        action: () => {
          navigate('/analytics')
          close()
        },
        group: 'Navigation',
        keywords: ['analytics', 'stats', 'players', 'tps'],
      },
      {
        id: 'nav-settings',
        label: 'Go to Settings',
        icon: <Settings className="w-4 h-4" />,
        action: () => {
          navigate('/settings')
          close()
        },
        group: 'Navigation',
        keywords: ['settings', 'preferences', 'config', 'theme', 'ngrok'],
      },
      {
        id: 'create-server',
        label: 'Create new server',
        icon: <Plus className="w-4 h-4" />,
        action: () => {
          navigate('/servers?create=true')
          close()
        },
        group: 'Actions',
        keywords: ['create', 'new', 'server', 'add'],
      },
      {
        id: 'open-ai-assistant',
        label: 'Open AI Assistant',
        icon: <Bot className="w-4 h-4" />,
        action: () => {
          window.dispatchEvent(new Event('catalyst:ai-assistant'))
          close()
        },
        group: 'Actions',
        keywords: ['ai', 'assistant', 'help', 'crash', 'settings'],
      },
      ...servers.flatMap((server): CommandAction[] => {
        const online = server.status === 'Online'
        const busy = server.status === 'Starting' || server.status === 'Stopping'
        const serverActions: CommandAction[] = [
          {
            id: `open-${server.id}`,
            label: `Open ${server.name}`,
            icon: <Server className="w-4 h-4" />,
            action: () => {
              navigate(`/servers/${server.id}`)
              close()
            },
            group: 'Servers',
            keywords: [server.name.toLowerCase(), 'open', 'panel', 'console'],
          },
        ]

        if (online) {
          serverActions.push(
            {
              id: `stop-${server.id}`,
              label: `Stop ${server.name}`,
              icon: <Square className="w-4 h-4" />,
              action: async () => {
                close()
                await stopServer(server.id)
              },
              group: 'Servers',
              keywords: [server.name.toLowerCase(), 'stop', 'kill'],
            },
            {
              id: `restart-${server.id}`,
              label: `Restart ${server.name}`,
              icon: <RotateCw className="w-4 h-4" />,
              action: async () => {
                close()
                await restartServer(server.id)
              },
              group: 'Servers',
              keywords: [server.name.toLowerCase(), 'restart', 'reboot'],
            }
          )
        } else if (!busy) {
          serverActions.push({
            id: `start-${server.id}`,
            label: `Start ${server.name}`,
            icon: <Play className="w-4 h-4" />,
            action: async () => {
              close()
              await startServer(server.id)
            },
            group: 'Servers',
            keywords: [server.name.toLowerCase(), 'start', 'run', 'launch'],
          })
        }

        return serverActions
      }),
    ]
  }, [servers, startServer, stopServer, restartServer, navigate])

  const filteredActions = search
    ? actions.filter((action) => {
        const query = search.toLowerCase()
        return (
          action.label.toLowerCase().includes(query) ||
          action.keywords?.some((kw) => kw.toLowerCase().includes(query))
        )
      })
    : actions

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
      <DialogContent className="overflow-hidden p-0 shadow-lg top-[30%] translate-y-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command shouldFilter={false} className="[&_[cmdk-input-wrapper]_svg]:hidden [&_[cmdk-input]]:border-0 [&_[cmdk-input]]:focus-visible:ring-0">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Search servers, actions, or navigate..."
              value={search}
              onValueChange={setSearch}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList className="max-h-[320px] overflow-y-auto p-1">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </CommandEmpty>
            {Object.entries(groupedActions).map(([group, groupActions]) => (
              <CommandGroup key={group} heading={group} className="overflow-hidden px-1 py-1">
                {groupActions.map((action) => (
                  <CommandItem
                    key={action.id}
                    value={action.id}
                    onSelect={action.action}
                    className="cursor-pointer rounded-lg"
                  >
                    <div className="mr-2 flex h-4 w-4 items-center justify-center text-muted-foreground">
                      {action.icon}
                    </div>
                    <span className="flex-1">{action.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          <div className="border-t px-3 py-2 text-xs text-muted-foreground">
            <p>
              <kbd className="font-data rounded border bg-muted px-1">Ctrl</kbd>
              <span className="mx-1">+</span>
              <kbd className="font-data rounded border bg-muted px-1">K</kbd>
              <span className="ml-2">to toggle</span>
            </p>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
