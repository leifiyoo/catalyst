import { create } from 'zustand'

export interface Server {
  id: string
  name: string
  online: boolean
  players?: number
  tps?: number
  memory?: number
  maxPlayers?: number
}

interface ServerStore {
  servers: Server[]
  setServers: (servers: Server[]) => void
  startServer: (id: string) => Promise<void>
  stopServer: (id: string) => Promise<void>
  restartServer: (id: string) => Promise<void>
  updateServer: (id: string, updates: Partial<Server>) => void
}

export const useServerStore = create<ServerStore>((set) => ({
  servers: [],
  
  setServers: (servers) => set({ servers }),
  
  startServer: async (id) => {
    // Call actual IPC to main process for server lifecycle
    await window.electron.ipcRenderer.invoke('server:start', id)
    set((state) => ({
      servers: state.servers.map((server) =>
        server.id === id
          ? { ...server, online: true }
          : server
      )
    }))
  },
  
  stopServer: async (id) => {
    // Call actual IPC to main process for server lifecycle
    await window.electron.ipcRenderer.invoke('server:stop', id)
    set((state) => ({
      servers: state.servers.map((server) =>
        server.id === id
          ? { ...server, online: false, players: 0 }
          : server
      )
    }))
  },
  
  restartServer: async (id) => {
    // Call actual IPC to main process for server lifecycle
    await window.electron.ipcRenderer.invoke('server:restart', id)
    set((state) => ({
      servers: state.servers.map((server) =>
        server.id === id
          ? { ...server, online: true }
          : server
      )
    }))
  },
  
  updateServer: (id, updates) => {
    set((state) => ({
      servers: state.servers.map((server) =>
        server.id === id
          ? { ...server, ...updates }
          : server
      )
    }))
  }
}))
