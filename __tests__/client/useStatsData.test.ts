import { renderHook, waitFor } from '@testing-library/react';
import { useStatsData } from '@/pages/Statistics/useStatsData';
import { getHistoryStats, getRealtimeStats } from '@/services/apiService';

jest.mock('@/services/apiService');

it('stops loading when history fails and retries on range change', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (getRealtimeStats as jest.Mock).mockRejectedValue(new Error('no'));
    (getHistoryStats as jest.Mock)
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ data: [] });
    const { result, rerender } = renderHook(
        ({ hours }) => useStatsData('a', hours, false),
        { initialProps: { hours: 24 } }
    );
    expect(result.current.loadingHistory).toBe(true);
    await waitFor(() => expect(result.current.loadingHistory).toBe(false));
    rerender({ hours: 6 });
    await waitFor(() => expect(getHistoryStats).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.loadingHistory).toBe(false));
});
