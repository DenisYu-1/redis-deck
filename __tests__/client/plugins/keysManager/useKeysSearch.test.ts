import { renderHook, act, waitFor } from '@testing-library/react';
import { useKeysSearch } from '@/plugins/plugins/keysManager/hooks/useKeysSearch';
import { getKeyDetails, searchKeys } from '@/services/apiService';
import { useToast } from '@/hooks/useToast';

jest.mock('@/services/apiService');
jest.mock('@/hooks/useToast');

const mockGetKeyDetails = getKeyDetails as jest.MockedFunction<typeof getKeyDetails>;
const mockSearchKeys = searchKeys as jest.MockedFunction<typeof searchKeys>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;

describe('useKeysSearch - Search History', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sessionStorage.clear();
        mockUseToast.mockReturnValue({
            showToast: jest.fn(),
        });
    });

    it('should initialize with empty history when sessionStorage is empty', () => {
        const { result } = renderHook(() => useKeysSearch('test-env'));
        expect(result.current.searchHistory).toEqual([]);
    });

    it('should load history from sessionStorage on initialization', () => {
        const storedHistory = ['user:*', 'order:*'];
        sessionStorage.setItem('redis-search-history', JSON.stringify(storedHistory));

        const { result } = renderHook(() => useKeysSearch('test-env'));
        expect(result.current.searchHistory).toEqual(storedHistory);
    });

    it('should add search to history when handleSearch is called', async () => {
        mockSearchKeys.mockResolvedValue({
            keys: [],
            cursors: ['0'],
            hasMore: false,
        });

        const { result } = renderHook(() => useKeysSearch('test-env'));

        act(() => {
            result.current.setInputValue('user:*');
        });

        await act(async () => {
            await result.current.handleSearch();
        });

        expect(result.current.searchHistory).toContain('user:*');
        expect(result.current.searchHistory[0]).toBe('user:*');
    });

    it('should not add empty search to history', async () => {
        mockSearchKeys.mockResolvedValue({
            keys: [],
            cursors: ['0'],
            hasMore: false,
        });

        const { result } = renderHook(() => useKeysSearch('test-env'));

        act(() => {
            result.current.setInputValue('   ');
        });

        await act(async () => {
            await result.current.handleSearch();
        });

        expect(result.current.searchHistory).not.toContain('   ');
    });

    it('should move existing item to top when searching again', async () => {
        sessionStorage.setItem('redis-search-history', JSON.stringify(['order:*', 'user:*']));
        mockSearchKeys.mockResolvedValue({
            keys: [],
            cursors: ['0'],
            hasMore: false,
        });

        const { result } = renderHook(() => useKeysSearch('test-env'));

        act(() => {
            result.current.setInputValue('order:*');
        });

        await act(async () => {
            await result.current.handleSearch();
        });

        expect(result.current.searchHistory[0]).toBe('order:*');
        expect(result.current.searchHistory.length).toBe(2);
    });

    it('should limit history to 10 items', async () => {
        const initialHistory = Array.from({ length: 10 }, (_, i) => `key${i}:*`);
        sessionStorage.setItem('redis-search-history', JSON.stringify(initialHistory));
        mockSearchKeys.mockResolvedValue({
            keys: [],
            cursors: ['0'],
            hasMore: false,
        });

        const { result } = renderHook(() => useKeysSearch('test-env'));

        act(() => {
            result.current.setInputValue('new-key:*');
        });

        await act(async () => {
            await result.current.handleSearch();
        });

        expect(result.current.searchHistory.length).toBe(10);
        expect(result.current.searchHistory[0]).toBe('new-key:*');
        expect(result.current.searchHistory).not.toContain('key0:*');
    });

    it('should handle history selection and move item to top', async () => {
        sessionStorage.setItem('redis-search-history', JSON.stringify(['order:*', 'user:*']));
        mockSearchKeys.mockResolvedValue({
            keys: [],
            cursors: ['0'],
            hasMore: false,
        });

        const { result } = renderHook(() => useKeysSearch('test-env'));

        act(() => {
            result.current.handleHistorySelect('user:*');
        });

        await waitFor(() => {
            expect(result.current.searchHistory[0]).toBe('user:*');
        });

        expect(result.current.inputValue).toBe('user:*');
        expect(result.current.searchPattern).toBe('user:*');
    });

    it('should persist history to sessionStorage', async () => {
        mockSearchKeys.mockResolvedValue({
            keys: [],
            cursors: ['0'],
            hasMore: false,
        });

        const { result } = renderHook(() => useKeysSearch('test-env'));

        act(() => {
            result.current.setInputValue('test:*');
        });

        await act(async () => {
            await result.current.handleSearch();
        });

        const stored = sessionStorage.getItem('redis-search-history');
        expect(stored).toBeTruthy();
        const parsed = JSON.parse(stored!);
        expect(parsed).toContain('test:*');
    });
});
