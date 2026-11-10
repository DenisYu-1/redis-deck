import {
    getThemePref,
    setThemePref,
    resolveTheme,
    applyTheme
} from '@/utils/theme';

describe('theme', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.classList.remove('dark-theme');
    });

    it('defaults to auto', () => {
        expect(getThemePref()).toBe('auto');
    });

    it('keeps a legacy stored light/dark value', () => {
        localStorage.setItem('redisdeck-theme', 'dark');
        expect(getThemePref()).toBe('dark');
    });

    it('ignores garbage in storage', () => {
        localStorage.setItem('redisdeck-theme', 'purple');
        expect(getThemePref()).toBe('auto');
    });

    it('persists the preference and sets data-theme', () => {
        setThemePref('dark');
        expect(localStorage.getItem('redisdeck-theme')).toBe('dark');
        expect(document.documentElement.dataset.theme).toBe('dark');
        expect(getThemePref()).toBe('dark');
    });

    it('auto leaves data-theme unset so the system scheme decides', () => {
        setThemePref('dark');
        setThemePref('auto');
        expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    });

    it('resolves auto from the system scheme', () => {
        expect(resolveTheme('auto', true)).toBe('dark');
        expect(resolveTheme('auto', false)).toBe('light');
        expect(resolveTheme('light', true)).toBe('light');
    });

    it('mirrors dark onto the legacy dark-theme class', () => {
        applyTheme('dark');
        expect(document.documentElement.classList.contains('dark-theme')).toBe(
            true
        );
        applyTheme('light');
        expect(document.documentElement.classList.contains('dark-theme')).toBe(
            false
        );
    });
});
