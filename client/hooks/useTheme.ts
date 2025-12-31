import { useState, useEffect } from 'react';
import { getTheme, type Theme } from '@/utils/theme';

export function useTheme(): Theme {
    const [theme, setThemeState] = useState<Theme>(getTheme());

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setThemeState(getTheme());
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });

        return () => observer.disconnect();
    }, []);

    return theme;
}
