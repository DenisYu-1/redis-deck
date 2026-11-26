import type { ConsoleCommands } from '@/services/apiService';
import type { RedisConnection } from '@/types';
import { allStatements } from './statements';

/** What the gutter shows for a line; `message` is its tooltip. */
export interface LineMark {
    kind: 'error' | 'warning' | 'write';
    message: string;
}

/**
 * The first two words of a statement, quoted as the server's `tokenize` reads
 * them (`services/redis.js`): enough to name the command.
 */
function commandWords(text: string): string[] {
    const words = text.match(/(?:"(?:\\.|[^"\\])*"?|'[^']*'?|[^\s"'])+/g) ?? [];
    return words
        .slice(0, 2)
        .map((word) =>
            word.replace(
                /"((?:\\.|[^"\\])*)"?|'([^']*)'?/g,
                (_, double?: string, single?: string) =>
                    double?.replace(/\\(.)/g, '$1') ?? single ?? ''
            )
        );
}

/** The command's name on the list, as `lookupCommand` on the server finds it. */
function commandName(text: string, list: ConsoleCommands): string {
    const [command = '', subcommand = ''] = commandWords(text);
    const base = command.toUpperCase();
    const hasSubcommands = Object.keys(list.commands).some((name) =>
        name.startsWith(`${base} `)
    );
    return hasSubcommands && subcommand
        ? `${base} ${subcommand.toUpperCase()}`
        : base;
}

function checkStatement(
    text: string,
    list: ConsoleCommands,
    connection: RedisConnection | undefined
): LineMark | undefined {
    const name = commandName(text, list);
    const entry = Object.hasOwn(list.commands, name)
        ? list.commands[name]
        : undefined;
    if (!entry) {
        const turnedOff = Object.hasOwn(list.turnedOff, name)
            ? list.turnedOff[name]
            : undefined;
        const message =
            turnedOff ?? list.unsupported.replace('{command}', () => name);
        return { kind: 'error', message };
    }
    const writes = entry.access === 'write';
    if (writes && connection?.readOnly) {
        return { kind: 'error', message: `${connection.id} is read-only` };
    }
    if (entry.warning) return { kind: 'warning', message: entry.warning };
    return writes ? { kind: 'write', message: 'Writes data' } : undefined;
}

/** The marks by line number; comment and empty lines never have one. */
export function checkLines(
    script: string,
    list: ConsoleCommands,
    connection: RedisConnection | undefined
): Map<number, LineMark> {
    const marks = new Map<number, LineMark>();
    for (const { line, text } of allStatements(script)) {
        const mark = checkStatement(text, list, connection);
        if (mark) marks.set(line, mark);
    }
    return marks;
}
