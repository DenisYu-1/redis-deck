import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { EnvironmentSelector } from '@/components/Environment/EnvironmentSelector';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { KeySearch } from '@/components/KeySearch/KeySearch';
import { KeyList } from '@/components/KeyList/KeyList';
import { KeyDetails } from '@/components/KeyDetails/KeyDetails';
import { Toast } from '@/components/common/Toast';
import { PluginContainer } from '@/plugins/PluginContainer';
import { usePlugins } from '@/plugins/usePlugins';
import { eventBus } from '@/plugins/eventBus';
import { useAppStore } from '@/store/useAppStore';
import { loadEnvironments, getKeyDetails, searchKeys, saveKey, deleteKey, addToSortedSet } from '@/services/apiService';
import { useToast } from '@/hooks/useToast';
import type { PluginContext } from '@/types';

export function Home() {
    const [searchPattern, setSearchPattern] = useState('*');
    const {
        connections,
        currentEnvironment,
        setConnections,
        setCurrentEnvironment,
        setSelectedKey,
        setIsLoading,
        isLoading,
    } = useAppStore();
    const { showToast } = useToast();

    useEffect(() => {
        const fetchConnections = async () => {
            setIsLoading(true);
            try {
                const conns = await loadEnvironments();
                setConnections(conns);
                if (conns.length > 0) {
                    setCurrentEnvironment(conns[0]?.id ?? '');
                }
            } catch (error) {
                showToast('Failed to load connections', 'error');
                console.error('Error loading connections:', error);
            } finally {
                setIsLoading(false);
            }
        };

        void fetchConnections();
    }, [setConnections, setCurrentEnvironment, setIsLoading, showToast]);

    const hasConnections = connections.length > 0;

    const handleSearch = (pattern: string) => {
        setSearchPattern(pattern);
    };

    const handleShowAll = () => {
        setSearchPattern('*');
    };

    const handleOperationComplete = () => {
        // Operation completed - KeyList will automatically refresh if needed
    };

    const pluginContext: PluginContext = {
        getCurrentEnvironment: () => currentEnvironment ?? '',
        onOperationComplete: handleOperationComplete,
        showToast: (
            message: string,
            type: 'success' | 'error' | 'warning' | 'info'
        ) => {
            showToast(message, type);
        }
    };

    const { emit } = usePlugins(pluginContext);

    // Bookings plugin logic - handles the 'bookings:add' event
    const handleBookingsAdd = async (event: any) => {
        const { targetUserId, environment } = event.payload;

        try {
            const timelinePattern = 'relevant-bookings:timeline:*';
            const allTimelineKeys = await fetchAllKeys(timelinePattern, environment, 1000);

            if (!allTimelineKeys || allTimelineKeys.length === 0) {
                showToast('No relevant timeline bookings found', 'error');
                return;
            }

            let validTimelineKey = null;
            let sourceUserId = null;

            for (const timelineKey of allTimelineKeys) {
                try {
                    const timelineDetails = await getKeyDetails(timelineKey, environment);
                    if (hasValidBookingsInTimeframe(timelineDetails, timelineKey)) {
                        validTimelineKey = timelineKey;
                        const parts = timelineKey.split(':');
                        sourceUserId = parts[parts.length - 1];
                        break;
                    }
                } catch (error) {
                    console.error(`Failed to check timeline ${timelineKey}:`, error);
                    continue;
                }
            }

            if (!validTimelineKey || !sourceUserId) {
                showToast('No timeline found with bookings in valid timeframe (-14 to +90 days)', 'error');
                return;
            }

            const timelineDetails = await getKeyDetails(validTimelineKey, environment);
            if (!timelineDetails || timelineDetails.value === undefined) {
                showToast('Failed to read timeline content for booking ID extraction', 'error');
                return;
            }

            const bookingIds = extractBookingIdsFromTimeline(timelineDetails.value);

            if (!bookingIds.length) {
                showToast(`No booking IDs found in timeline for user ${sourceUserId}`, 'error');
                return;
            }

            const dataKeys = bookingIds.map((bookingId) => `relevant-bookings:data:${sourceUserId}:${bookingId}`);

            const newTimelineKey = `relevant-bookings:timeline:${targetUserId}`;

            if (await keyExists(newTimelineKey, environment)) {
                await deleteKey(newTimelineKey, environment);
            }

            const timelineTtl = typeof timelineDetails.ttl === 'number' ? timelineDetails.ttl : -1;

            let members = [];
            if (timelineDetails.value) {
                try {
                    if (typeof timelineDetails.value === 'string' && timelineDetails.value.trim().startsWith('[')) {
                        const parsedValue = JSON.parse(timelineDetails.value);
                        if (Array.isArray(parsedValue)) {
                            members = parsedValue.filter((item) =>
                                typeof item === 'object' && typeof item.score === 'number' && item.value !== undefined
                            );
                        }
                    } else if (Array.isArray(timelineDetails.value)) {
                        members = timelineDetails.value.filter((item) =>
                            typeof item === 'object' && typeof item.score === 'number' && item.value !== undefined
                        );
                    } else {
                        members = [{
                            score: Math.floor(Date.now() / 1000),
                            value: String(timelineDetails.value)
                        }];
                    }
                } catch {
                    console.error('Failed to parse timeline value, using as single member:', timelineDetails.value);
                    members = [{
                        score: Math.floor(Date.now() / 1000),
                        value: String(timelineDetails.value)
                    }];
                }
            }

            if (members.length === 0) {
                members = [{
                    score: Math.floor(Date.now() / 1000),
                    value: `timeline-${targetUserId}`
                }];
            }

            await addToSortedSet(newTimelineKey, members, timelineTtl > 0 ? timelineTtl : null, environment);

            let copiedCount = 0;

            for (let i = 0; i < dataKeys.length; i++) {
                const dataKey = dataKeys[i];
                if (!dataKey) continue;
                try {
                    if (!(await keyExists(dataKey, environment))) {
                        continue;
                    }

                    const dataDetails = await getKeyDetails(dataKey, environment);
                    if (!dataDetails || dataDetails.value === undefined) {
                        continue;
                    }

                    const dataParts = dataKey.split(':');
                    const bookingId = dataParts[dataParts.length - 1];
                    const newDataKey = `relevant-bookings:data:${targetUserId}:${bookingId}`;

                    if (await keyExists(newDataKey, environment)) {
                        await deleteKey(newDataKey, environment);
                    }

                    const dataTtl = typeof dataDetails.ttl === 'number' ? dataDetails.ttl : -1;
                    await saveKey(newDataKey, dataDetails.value, dataTtl > 0 ? dataTtl : null, environment);
                    copiedCount += 1;
                } catch (dataKeyError) {
                    console.error(`Error processing data key ${dataKey || 'unknown'}:`, dataKeyError);
                }
            }

            if (copiedCount === 0) {
                showToast(`Warning: No booking data keys were copied for ${targetUserId}`, 'warning');
            } else {
                showToast(`Successfully added booking for ${targetUserId}. Copied ${copiedCount} booking data key(s).`, 'success');
            }

            handleOperationComplete();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            showToast(errorMessage, 'error');
            console.error('Error adding booking:', error);
        }
    };

    // Helper functions for bookings logic
    const fetchAllKeys = async (pattern: string, environment: string, count = 200): Promise<string[]> => {
        const collected: string[] = [];
        let cursor = '0';
        do {
            const result = await searchKeys(pattern, [cursor], count, environment);
            if (result.keys && result.keys.length) {
                collected.push(...result.keys);
            }
            cursor = result.cursors?.[0] || '0';
        } while (cursor !== '0');
        return collected;
    };

    const keyExists = async (key: string, environment: string): Promise<boolean> => {
        try {
            await getKeyDetails(key, environment);
            return true;
        } catch {
            return false;
        }
    };

    const extractBookingIdsFromTimeline = (timelineValue: unknown): string[] => {
        const bookingIds: string[] = [];

        if (typeof timelineValue !== 'string') {
            return bookingIds;
        }

        const value = timelineValue.trim();
        const lines = value.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            if (trimmedLine.includes(':')) {
                const parts = trimmedLine.split(':');
                if (parts.length >= 2) {
                    const bookingId = parts[0];
                    if (bookingId && !bookingIds.includes(bookingId)) {
                        bookingIds.push(bookingId);
                    }
                }
            }
        }

        return bookingIds;
    };

    const hasValidBookingsInTimeframe = (timelineDetails: any, timelineKey = 'unknown'): boolean => {
        if (!timelineDetails || timelineDetails.value === undefined) {
            return false;
        }

        const now = Date.now();
        const fourteenDaysAgo = now + (-14) * 24 * 60 * 60 * 1000;
        const ninetyDaysFromNow = now + 90 * 24 * 60 * 60 * 1000;

        let timestamps: number[] = [];

        try {
            if (typeof timelineDetails.value === 'string') {
                const value = timelineDetails.value.trim();
                const lines = value.split('\n');

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;

                    if (trimmedLine.includes(':')) {
                        const parts = trimmedLine.split(':');
                        const score = parts[parts.length - 1];
                        const scoreNum = parseInt(score, 10);
                        if (!isNaN(scoreNum) && scoreNum >= 946684800 && scoreNum <= 4102444800) {
                            timestamps.push(scoreNum);
                        }
                    } else {
                        const scoreNum = parseInt(trimmedLine, 10);
                        if (!isNaN(scoreNum) && scoreNum >= 946684800 && scoreNum <= 4102444800) {
                            timestamps.push(scoreNum);
                        }
                    }
                }
            } else if (Array.isArray(timelineDetails.value)) {
                timestamps = timelineDetails.value
                    .filter((item: any) => typeof item === 'object' && typeof item.score === 'number')
                    .map((item: any) => item.score);
            }

            const validTimestamps = timestamps.filter((timestamp) => {
                const timestampInMs = timestamp * 1000;
                const isValid = timestampInMs >= fourteenDaysAgo && timestampInMs <= ninetyDaysFromNow;
                return isValid;
            });

            return validTimestamps.length > 0;
        } catch {
            console.error(`Failed to parse timeline value for timeframe check (${timelineKey}):`, timelineDetails.value);
            return false;
        }
    };

    // Listen for plugin events
    useEffect(() => {
        const handlePluginEvents = (event: any) => {
            if (event.type === 'bookings:add') {
                void handleBookingsAdd(event);
            } else if (event.type === 'toast:show') {
                const { message, type } = event.payload;
                showToast(message, type);
            } else if (event.type === 'keys:selected' && event.payload.action === 'search') {
                // Handle quick search from plugins
                const { pattern } = event.payload;
                setSearchPattern(pattern);
                handleSearch(pattern);
            }
        };

        // Subscribe to the event bus for plugin events
        const unsubscribeBookings = eventBus.on('bookings:add', handlePluginEvents);
        const unsubscribeToast = eventBus.on('toast:show', handlePluginEvents);
        const unsubscribeKeysSelected = eventBus.on('keys:selected', handlePluginEvents);

        return () => {
            unsubscribeBookings?.();
            unsubscribeToast?.();
            unsubscribeKeysSelected?.();
        };
    }, [currentEnvironment, showToast]);

    const handleKeySelect = (key: string) => {
        setSelectedKey(key);
        // Emit event so plugins know a key was selected
        emit({
            type: 'keys:selected',
            payload: { keys: [key] },
            source: 'app'
        });
    };

    if (isLoading) {
        return <></>;
    }

    if (!hasConnections) {
        return (
            <div className="container">
                <Header showNavigation={true} showBackButton={false}>
                    <div
                        className="connection-info"
                        style={{ display: 'none' }}
                    />
                </Header>
                <main>
                    <EmptyState />
                </main>
                <Toast />
            </div>
        );
    }

    return (
        <div className="container">
            <Header showNavigation={true} showBackButton={false}>
                <EnvironmentSelector />
            </Header>
            <main>
                <KeySearch searchPattern={searchPattern} onSearch={handleSearch} onShowAll={handleShowAll} />
                <div className="results-area">
                    <div className="key-row">
                    <KeyList
                        searchPattern={searchPattern}
                        onKeySelect={handleKeySelect}
                    />
                        <KeyDetails
                            onOperationComplete={handleOperationComplete}
                        />
                    </div>
                    <PluginContainer context={pluginContext} />
                </div>
            </main>
            <Toast />
        </div>
    );
}
