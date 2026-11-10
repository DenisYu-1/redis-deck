import { renderHook, act } from '@testing-library/react';
import { resetThemeStore, useTheme } from '@/hooks/useTheme';

it('all useTheme callers share one preference', () => {
    localStorage.clear();
    resetThemeStore();
    const a = renderHook(() => useTheme());
    const b = renderHook(() => useTheme());
    act(() => a.result.current.setPref('dark'));
    expect(b.result.current.pref).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
});
