import { renderHook, act } from '@testing-library/react';
import { useKeySelection } from '@/pages/Keys/hooks/useKeySelection';

describe('useKeySelection', () => {
    const visible = ['a', 'b', 'c'];

    it('toggles single keys', () => {
        const { result } = renderHook(() => useKeySelection(visible));
        act(() => result.current.toggle('a'));
        expect(result.current.has('a')).toBe(true);
        expect(result.current.count).toBe(1);
        act(() => result.current.toggle('a'));
        expect(result.current.count).toBe(0);
    });

    it('select-all covers every visible key and toggles back', () => {
        const { result } = renderHook(() => useKeySelection(visible));
        expect(result.current.allSelected).toBe(false);
        act(() => result.current.toggleAll());
        expect(result.current.keys).toEqual(['a', 'b', 'c']);
        expect(result.current.allSelected).toBe(true);
        act(() => result.current.toggleAll());
        expect(result.current.count).toBe(0);
    });

    it('drops selected keys that are no longer visible', () => {
        const { result, rerender } = renderHook(
            ({ keys }) => useKeySelection(keys),
            { initialProps: { keys: visible } }
        );
        act(() => result.current.toggleAll());
        rerender({ keys: ['a'] });
        expect(result.current.keys).toEqual(['a']);
        expect(result.current.allSelected).toBe(true);
    });

    it('clear empties the selection', () => {
        const { result } = renderHook(() => useKeySelection(visible));
        act(() => result.current.toggleAll());
        act(() => result.current.clear());
        expect(result.current.count).toBe(0);
    });
});
