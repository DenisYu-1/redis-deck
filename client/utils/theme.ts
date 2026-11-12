const THEME_KEY = 'redisdeck-theme';

export type ThemePref = 'auto' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const PREFS: ThemePref[] = ['auto', 'light', 'dark'];

export function getThemePref(): ThemePref {
    try {
        const stored = localStorage.getItem(THEME_KEY) as ThemePref | null;
        return stored && PREFS.includes(stored) ? stored : 'auto';
    } catch {
        return 'auto';
    }
}

export function systemPrefersDark(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
    );
}

export function resolveTheme(pref: ThemePref, systemDark: boolean): Theme {
    if (pref === 'auto') return systemDark ? 'dark' : 'light';
    return pref;
}

/** Mirrors the resolved theme onto the legacy `dark-theme` class used by old CSS. */
export function applyTheme(theme: Theme): void {
    document.documentElement.classList.toggle('dark-theme', theme === 'dark');
}

/** Sets `data-theme` (absent for auto so the system scheme decides) and the legacy class. */
export function applyThemePref(pref: ThemePref): void {
    const root = document.documentElement;
    if (pref === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', pref);
    applyTheme(resolveTheme(pref, systemPrefersDark()));
}

export function setThemePref(pref: ThemePref): void {
    try {
        localStorage.setItem(THEME_KEY, pref);
    } catch {
        // storage unavailable: preference lasts for this page load only
    }
    applyThemePref(pref);
}
