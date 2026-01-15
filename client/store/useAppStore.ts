import { create } from 'zustand';
import type { RedisConnection, KeyDetails } from '@/types';

interface AppState {
    connections: RedisConnection[];
    currentEnvironment: string | null;
    selectedKey: string | null;
    keyDetails: KeyDetails | null;
    isLoading: boolean;
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
    setConnections: (connections) => set({ connections }),
    setCurrentEnvironment: (environment) =>
        set({ currentEnvironment: environment }),
    setSelectedKey: (key) => set({ selectedKey: key }),
    setKeyDetails: (details) => set({ keyDetails: details }),
    setIsLoading: (loading) => set({ isLoading: loading })
}));
