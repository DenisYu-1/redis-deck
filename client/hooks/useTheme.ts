import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
    applyThemePref,
    getThemePref,
    resolveTheme,
    setThemePref,
    systemPrefersDark,
    type Theme,
    type ThemePref
} from '@/utils/theme';

// One shared preference for every useTheme() caller (AppShell, ThemeToggle, ...),
// so an OS scheme change can never re-apply a stale copy over the user's choice.
let currentPref: ThemePref | null = null;
const listeners = new Set<() => void>();

const readPref = (): ThemePref => (currentPref ??= getThemePref());
const subscribePref = (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};

const subscribeSystem = (fn: () => void) => {
    if (typeof window.matchMedia !== 'function') return () => undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
};

/** Test hook: forget the cached preference so it is re-read from storage. */
export function resetThemeStore(): void {
    currentPref = null;
}

export function useTheme(): {
    pref: ThemePref;
    theme: Theme;
    setPref: (pref: ThemePref) => void;
} {
    const pref = useSyncExternalStore(subscribePref, readPref);
    const systemDark = useSyncExternalStore(subscribeSystem, systemPrefersDark);

    useEffect(() => {
        applyThemePref(pref);
    }, [pref, systemDark]);

    const setPref = useCallback((next: ThemePref) => {
        setThemePref(next);
        currentPref = next;
        listeners.forEach((fn) => fn());
    }, []);

    return { pref, theme: resolveTheme(pref, systemDark), setPref };
}
