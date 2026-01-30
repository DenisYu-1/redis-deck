const THEME_KEY = 'redisdeck-theme';

export type Theme = 'light' | 'dark';

export function getTheme(): Theme {
    const stored = localStorage.getItem(THEME_KEY);
    return (stored === 'dark' ? 'dark' : 'light') as Theme;
}

export function setTheme(theme: Theme): void {
    localStorage.setItem(THEME_KEY, theme);
    if (theme === 'dark') {
        document.documentElement.classList.add('dark-theme');
    } else {
        document.documentElement.classList.remove('dark-theme');
    }
}

export function toggleTheme(): Theme {
    const current = getTheme();
    const newTheme = current === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    return newTheme;
}
