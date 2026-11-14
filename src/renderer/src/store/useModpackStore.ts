import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ModpackSet {
  id: string;
  name: string;
  version: string;
  plugins: string[];
  config: Record<string, any>;
  createdAt: number;
}

interface ModpackStore {
  sets: ModpackSet[];
  createSet: (set: Omit<ModpackSet, 'id' | 'createdAt'>) => void;
  deleteSet: (id: string) => void;
}

export const useModpackStore = create<ModpackStore>()(
  persist(
    (set) => ({
      sets: [],
      createSet: (newSet) => set((state) => ({
        sets: [...state.sets, { ...newSet, id: crypto.randomUUID(), createdAt: Date.now() }]
      })),
      deleteSet: (id) => set((state) => ({
        sets: state.sets.filter((s) => s.id !== id)
      })),
    }),
    { name: 'catalyst-modpack-storage' }
  )
);