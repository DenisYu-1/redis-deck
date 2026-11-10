import { Segmented } from '@/components/ui/Segmented';
import { MonitorIcon, MoonIcon, SunIcon } from '@/components/ui/Icons';
import { useTheme } from '@/hooks/useTheme';
import type { ThemePref } from '@/utils/theme';

export function ThemeToggle() {
    const { pref, setPref } = useTheme();
    return (
        <Segmented<ThemePref>
            label="Theme"
            iconOnly
            value={pref}
            onChange={setPref}
            options={[
                { value: 'auto', label: 'Auto', icon: <MonitorIcon /> },
                { value: 'light', label: 'Light', icon: <SunIcon /> },
                { value: 'dark', label: 'Dark', icon: <MoonIcon /> }
            ]}
        />
    );
}
