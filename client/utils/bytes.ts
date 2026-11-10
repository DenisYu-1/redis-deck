import { formatBytes } from './formatter';

/** Key memory size for a list row; null when the server could not report it. */
export function formatSize(bytes: number | null | undefined): string {
    return bytes === null || bytes === undefined ? '–' : formatBytes(bytes);
}
