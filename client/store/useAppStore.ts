import { create } from 'zustand';
import type { RedisConnection, KeyDetails } from '@/types';

interface AppState {
    connections: RedisConnection[];
    currentEnvironment: string | null;
    selectedKey: string | null;
    keyDetails: KeyDetails | null;
    isLoading: boolean;
    /** Key pattern applied on the Keys page (shared so the sidebar can apply saved searches). */
    keyPattern: string;
    setKeyPattern: (pattern: string) => void;
    setConnections: (connections: RedisConnection[]) => void;
    setCurrentEnvironment: (environment: string) => void;
    setSelectedKey: (key: string | null) => void;
    setKeyDetails: (details: KeyDetails | null) => void;
    setIsLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
    connections: [],
    currentEnvironment: null,
    selectedKey: null,
    keyDetails: null,
    isLoading: false,
    keyPattern: '*',
    setKeyPattern: (pattern) => set({ keyPattern: pattern }),
    setConnections: (connections) => set({ connections }),
    // A key belongs to one connection: switching drops the open key and its details.
    setCurrentEnvironment: (environment) =>
        set((s) =>
            s.currentEnvironment === environment
                ? s
                : {
                      currentEnvironment: environment,
                      selectedKey: null,
                      keyDetails: null
                  }
        ),
    setSelectedKey: (key) => set({ selectedKey: key }),
    setKeyDetails: (details) => set({ keyDetails: details }),
    setIsLoading: (loading) => set({ isLoading: loading })
}));
