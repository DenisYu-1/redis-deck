import { renderHook, waitFor } from '@testing-library/react';
import { useKeyDetail } from '@/pages/Keys/hooks/useKeyDetail';
import { getKeyDetails, getKeyInfo } from '@/services/apiService';

jest.mock('@/services/apiService');

it('does not expose another connection while the new one loads', async () => {
    (getKeyDetails as jest.Mock).mockImplementation(
        (key: string, env: string) =>
            env === 'b'
                ? new Promise(() => undefined)
                : Promise.resolve({ key, type: 'string', value: 'from-a' })
    );
    (getKeyInfo as jest.Mock).mockResolvedValue({ type: 'string' });
    const { result, rerender } = renderHook(
        ({ env, key }) => useKeyDetail(env, key),
        { initialProps: { env: 'a', key: 'k' } }
    );
    await waitFor(() => expect(result.current.details?.value).toBe('from-a'));
    rerender({ env: 'b', key: 'k' });
    expect(result.current.details).toBeNull();
    expect(result.current.info).toBeNull();
});
