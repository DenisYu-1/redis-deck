import type { TileId } from './tiles';

export type WidgetId =
    | 'tiles'
    | 'chart-memory'
    | 'chart-keyspace'
    | 'chart-hitrate'
    | 'chart-ops'
    | 'commands'
    | 'slowlog'
    | 'patterns';

export interface Board {
    id: string;
    title: string;
    /** Tiles shown by the `tiles` widget; all when omitted. */
    tiles?: TileId[];
    widgets: WidgetId[];
}

const OVERVIEW: Board = {
        id: 'overview',
        title: 'Overview',
        widgets: [
            'tiles',
            'chart-memory',
            'chart-keyspace',
            'chart-hitrate',
            'chart-ops',
            'commands',
            'slowlog',
            'patterns'
        ]
    }
};

export const BOARDS: Board[] = [
    OVERVIEW,
    {
        id: 'memory',
        title: 'Memory deep-dive',
        tiles: ['mem', 'keys'],
        widgets: ['tiles', 'chart-memory', 'chart-keyspace', 'patterns']
    }
];

export const WIDGET_TITLES: Record<WidgetId, string> = {
    tiles: 'Key metrics',
    'chart-memory': 'Memory usage',
    'chart-keyspace': 'Keyspace',
    'chart-hitrate': 'Hit rate',
    'chart-ops': 'Operations/sec',
    commands: 'Command stats',
    slowlog: 'Slow log',
    patterns: 'Memory by pattern'
};

export function boardById(id: string | undefined): Board {
    return BOARDS.find((b) => b.id === id) ?? OVERVIEW;
}

const key = (env: string, board: string) =>
    `redisdeck-stats-layout:${env}:${board}`;

export function loadRemoved(env: string, board: string): string[] {
    try {
        const v: unknown = JSON.parse(
            localStorage.getItem(key(env, board)) ?? '[]'
        );
        return Array.isArray(v)
            ? v.filter((x): x is string => typeof x === 'string')
            : [];
    } catch {
        return [];
    }
}

export function saveRemoved(env: string, board: string, ids: string[]): void {
    try {
        localStorage.setItem(key(env, board), JSON.stringify(ids));
    } catch {
        // storage unavailable: layout lasts for this page load only
    }
}
