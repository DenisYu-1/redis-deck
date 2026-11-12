export type DecodeMode = 'auto' | 'raw' | 'json' | 'php';
export type DetectedFormat = 'raw' | 'json' | 'php';

export interface Decoded {
    format: DetectedFormat;
    /** False when a forced decoder could not parse the input (text is raw). */
    ok: boolean;
    text: string;
}

type PhpValue = null | boolean | number | string | PhpValue[] | PhpObject;
// Interface (not Record) so the alias can reference itself recursively.
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
interface PhpObject {
    [key: string]: PhpValue;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Minimal PHP `unserialize`; throws on malformed input. */
export function phpUnserialize(input: string): PhpValue {
    const bytes = enc.encode(input);
    let pos = 0;

    const fail = (): never => {
        throw new Error(`Invalid PHP serialize data at byte ${String(pos)}`);
    };
    const expect = (ch: string) => {
        if (bytes[pos] !== ch.charCodeAt(0)) fail();
        pos++;
    };
    const readUntil = (ch: string): string => {
        const end = bytes.indexOf(ch.charCodeAt(0), pos);
        if (end < 0) return fail();
        const out = dec.decode(bytes.subarray(pos, end));
        pos = end + 1;
        return out;
    };
    const readInt = (until: string): number => {
        const raw = readUntil(until);
        if (!/^-?\d+$/.test(raw)) fail();
        return Number(raw);
    };
    const readStr = (): string => {
        const len = readInt(':');
        expect('"');
        if (pos + len > bytes.length) fail();
        const out = dec.decode(bytes.subarray(pos, pos + len));
        pos += len;
        expect('"');
        return out;
    };
    const readEntries = (count: number): [string, PhpValue][] => {
        expect('{');
        const entries: [string, PhpValue][] = [];
        for (let i = 0; i < count; i++) {
            entries.push([String(read()), read()]);
        }
        expect('}');
        return entries;
    };

    function read(): PhpValue {
        const tag = String.fromCharCode(bytes[pos] ?? 0);
        pos++;
        if (tag === 'N') {
            expect(';');
            return null;
        }
        expect(':');
        switch (tag) {
            case 'b':
                return readUntil(';') === '1';
            case 'i':
                return readInt(';');
            case 'd': {
                const n = Number(readUntil(';'));
                if (Number.isNaN(n)) fail();
                return n;
            }
            case 's': {
                const s = readStr();
                expect(';');
                return s;
            }
            case 'a': {
                const entries = readEntries(readInt(':'));
                const isList = entries.every(([k], i) => k === String(i));
                return isList
                    ? entries.map(([, v]) => v)
                    : Object.fromEntries(entries);
            }
            case 'O': {
                const cls = readStr();
                expect(':');
                const entries = readEntries(readInt(':'));
                return { __class: cls, ...Object.fromEntries(entries) };
            }
            default:
                return fail();
        }
    }

    const value = read();
    if (pos !== bytes.length) fail();
    return value;
}

function tryJson(text: string): unknown {
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return undefined;
    }
}

function isStructured(v: unknown): boolean {
    return typeof v === 'object' && v !== null;
}

export function detectFormat(text: string): DetectedFormat {
    if (isStructured(tryJson(text))) return 'json';
    try {
        phpUnserialize(text);
        return 'php';
    } catch {
        return 'raw';
    }
}

const pretty = (v: unknown) => JSON.stringify(v, null, 2);

export function decodeValue(text: string, mode: DecodeMode): Decoded {
    const format = mode === 'auto' ? detectFormat(text) : mode;
    if (format === 'json') {
        const parsed = tryJson(text);
        return parsed === undefined
            ? { format, ok: false, text }
            : { format, ok: true, text: pretty(parsed) };
    }
    if (format === 'php') {
        try {
            return { format, ok: true, text: pretty(phpUnserialize(text)) };
        } catch {
            return { format, ok: false, text };
        }
    }
    return { format: 'raw', ok: true, text };
}
