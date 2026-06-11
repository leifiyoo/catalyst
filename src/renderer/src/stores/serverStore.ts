import { create } from 'zustand'
import type { ServerRecord, ServerRuntimeStatus, ServerStatusUpdate, ServerStats } from '@shared/types'

export interface ServerEvent {
  serverId: string
  serverName: string
  status: ServerRuntimeStatus
  at: number
}

interface ServerStore {
  servers: ServerRecord[]
  loaded: boolean
  /** Live runtime stats per server id (TPS, memory, players) */
  stats: Record<string, ServerStats>
  /** Real status-change events observed this session, newest first */
  events: ServerEvent[]
  refresh: () => Promise<void>
  applyStatus: (update: ServerStatusUpdate) => void
  applyStats: (stats: ServerStats) => void
  removeServer: (id: string) => void
  startServer: (id: string) => Promise<void>
  stopServer: (id: string) => Promise<void>
  restartServer: (id: string) => Promise<void>
}

export const useServerStore = create<ServerStore>((set) => ({
  servers: [],
  loaded: false,
  stats: {},
  events: [],

  refresh: async () => {
    try {
      const servers = (await window.context?.getServers?.()) ?? []
      set({ servers, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  applyStatus: (update) =>
    set((state) => {
      const target = state.servers.find((server) => server.id === update.serverId)
      const statusChanged = target && target.status !== update.status

      return {
        servers: state.servers.map((server) =>
          server.id === update.serverId
            ? { ...server, status: update.status, players: update.players ?? server.players }
            : server
        ),
        stats:
          update.status === 'Offline' || update.status === 'Stopping'
            ? Object.fromEntries(Object.entries(state.stats).filter(([serverId]) => serverId !== update.serverId))
            : state.stats,
        events: statusChanged
          ? [
              { serverId: update.serverId, serverName: target.name, status: update.status, at: Date.now() },
              ...state.events,
            ].slice(0, 20)
          : state.events,
      }
    }),

  applyStats: (stats) =>
    set((state) => ({
      stats: { ...state.stats, [stats.serverId]: stats },
    })),

  removeServer: (id) =>
    set((state) => ({
      servers: state.servers.filter((server) => server.id !== id),
      stats: Object.fromEntries(Object.entries(state.stats).filter(([serverId]) => serverId !== id)),
    })),

  startServer: async (id) => {
    useServerStore.getState().applyStatus({ serverId: id, status: 'Starting' })
    const result = await window.context.startServer(id)
    if (!result?.success) {
      useServerStore.getState().applyStatus({ serverId: id, status: 'Offline' })
    }
  },

  stopServer: async (id) => {
    useServerStore.getState().applyStatus({ serverId: id, status: 'Stopping' })
    const result = await window.context.stopServer(id)
    if (result?.success) {
      useServerStore.getState().applyStatus({ serverId: id, status: 'Offline', players: '0/20' })
    } else {
      useServerStore.getState().refresh()
    }
  },

  restartServer: async (id) => {
    await window.context.restartServer(id)
  },
}))

let syncStarted = false

/**
 * Starts the global server sync exactly once per renderer session:
 * initial fetch, live status / stats subscriptions and refresh on focus.
 */
export function startServerSync() {
  if (syncStarted) return
  syncStarted = true

  // No preload bridge (e.g. renderer opened outside Electron) — show empty states
  if (!window.context) {
    useServerStore.setState({ loaded: true })
    return
  }

  const { refresh } = useServerStore.getState()
  refresh()

  window.context.onServerStatus((update) => {
    useServerStore.getState().applyStatus(update)
  })
  window.context.onServerStats((stats) => {
    useServerStore.getState().applyStats(stats)
  })
  window.addEventListener('focus', () => {
    useServerStore.getState().refresh()
  })
}
