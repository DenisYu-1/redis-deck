interface DesktopApi {
    setTitleBarColors: (color: string, symbolColor: string) => void;
}
const api = (): DesktopApi | undefined =>
    (window as unknown as { desktop?: DesktopApi }).desktop;

/** True inside the Electron app (preload exposes `window.desktop`). */
export const isDesktop = (): boolean => !!api();

/** Pushes the current theme colors to the native title bar overlay. */
export function syncDesktopTitleBar(): void {
    const d = api();
    if (!d) return;
    const css = getComputedStyle(document.documentElement);
    d.setTitleBarColors(
        css.getPropertyValue('--bg').trim(),
        css.getPropertyValue('--tx').trim()
    );
}
