import { useCallback, useEffect, useState } from 'react';
import {
    applyThemePref,
    getThemePref,
    resolveTheme,
    setThemePref,
    systemPrefersDark,
    type Theme,
    type ThemePref
} from '@/utils/theme';

export function useTheme(): {
    pref: ThemePref;
    theme: Theme;
    setPref: (pref: ThemePref) => void;
} {
    const [pref, setPrefState] = useState<ThemePref>(getThemePref);
    const [systemDark, setSystemDark] = useState(systemPrefersDark);

    useEffect(() => {
        applyThemePref(pref);
    }, [pref, systemDark]);

    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => setSystemDark(mq.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    const setPref = useCallback((next: ThemePref) => {
        setThemePref(next);
        setPrefState(next);
    }, []);

    return { pref, theme: resolveTheme(pref, systemDark), setPref };
}
