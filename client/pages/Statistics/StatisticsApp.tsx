import { useState, useEffect, useCallback } from 'react';
import { MetricsGrid } from './components/MetricsGrid';
import { ChartsSection } from './components/ChartsSection';
import { CommandStatsTable } from './components/CommandStatsTable';
import { SlowLogTable } from './components/SlowLogTable';
import { MemoryPatternAnalysis } from './components/MemoryPatternAnalysis';
import { useAppStore } from '@/store/useAppStore';
import { useToast } from '@/hooks/useToast';
import { getRealtimeStats } from '@/services/apiService';
import type { RealtimeStats } from '@/types';
import './statistics.css';

export function StatisticsApp() {
    const [stats, setStats] = useState<RealtimeStats | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const { currentEnvironment } = useAppStore();
    const { showToast } = useToast();

    const fetchStats = useCallback(async () => {
        if (!currentEnvironment) return;

        setIsLoading(true);
        try {
            const data = await getRealtimeStats(currentEnvironment);
            setStats(data);
        } catch (error) {
            showToast('Failed to load statistics', 'error');
            console.error('Error loading stats:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentEnvironment, showToast]);

    useEffect(() => {
        if (currentEnvironment) {
            fetchStats();
        }
    }, [fetchStats, currentEnvironment]);

    useEffect(() => {
        if (!autoRefresh || !currentEnvironment) return;

        const interval = setInterval(() => void fetchStats(), 30000); // 30 seconds
        return () => clearInterval(interval);
    }, [autoRefresh, currentEnvironment, fetchStats]);

    const handleRefresh = () => {
        fetchStats();
    };

    const handleToggleAutoRefresh = () => {
        setAutoRefresh((prev) => !prev);
    };

    return (
        <div className="container">
            <main className="stats-container">
                <div className="stats-header">
                    <h2>Redis Statistics</h2>
                    <div className="stats-controls">
                        <button
                            onClick={handleRefresh}
                            disabled={isLoading}
                            className="refresh-btn"
                        >
                            {isLoading ? '🔄 Refreshing...' : '🔄 Refresh'}
                        </button>
                        <button
                            onClick={handleToggleAutoRefresh}
                            className={`secondary-btn ${autoRefresh ? 'active' : ''}`}
                        >
                            {autoRefresh ? '⏸️ Pause Auto' : '▶️ Start Auto'}
                        </button>
                    </div>
                </div>

                {stats && <MetricsGrid stats={stats} />}

                <ChartsSection />

                <CommandStatsTable />

                <SlowLogTable />

                <MemoryPatternAnalysis />
            </main>
        </div>
    );
}
