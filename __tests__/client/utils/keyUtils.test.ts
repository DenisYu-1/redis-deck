import { formatTtl, isTtlWarn } from '@/utils/ttl';
import { formatSize } from '@/utils/bytes';
import { globToRegExp, highlightRange } from '@/utils/glob';
import { buildKeyTree, flattenTree } from '@/utils/keyTree';

describe('formatTtl', () => {
    it.each([
        [-1, '∞'],
        [-2, 'gone'],
        [0, '0s'],
        [45, '45s'],
        [90, '1m'],
        [3600, '1h'],
        [5400, '1h 30m'],
        [86400, '1d'],
        [90000, '1d 1h']
    ])('%s -> %s', (ttl, text) => expect(formatTtl(ttl)).toBe(text));
    it('warns under 5 minutes only for expiring keys', () => {
        expect(isTtlWarn(299)).toBe(true);
        expect(isTtlWarn(300)).toBe(false);
        expect(isTtlWarn(-1)).toBe(false);
    });
});

describe('formatSize', () => {
    it('formats bytes and unknown', () => {
        expect(formatSize(null)).toBe('–');
        expect(formatSize(512)).toBe('512 B');
        expect(formatSize(1536)).toBe('1.5 KB');
    });
});

describe('glob', () => {
    it('supports * ? [] and escapes regex chars', () => {
        expect(globToRegExp('user:*').test('user:1')).toBe(true);
        expect(globToRegExp('user:*').test('xuser:1')).toBe(false);
        expect(globToRegExp('a?c').test('abc')).toBe(true);
        expect(globToRegExp('k[ab]').test('kb')).toBe(true);
        expect(globToRegExp('k[^ab]').test('ka')).toBe(false);
        expect(globToRegExp('a.b').test('axb')).toBe(false);
        expect(globToRegExp('a\\*').test('a*')).toBe(true);
    });
    it('highlightRange finds the literal part that matched', () => {
        expect(highlightRange('*name*', 'user:name:1')).toEqual([5, 9]);
        expect(highlightRange('user:*', 'user:1')).toEqual([0, 5]);
        expect(highlightRange('*', 'abc')).toBeNull();
        expect(highlightRange('zzz*', 'abc')).toBeNull();
    });
});

describe('key tree', () => {
    const keys = ['a:b:1', 'a:b:2', 'a:c', 'solo'];
    it('groups by ":" with loaded counts', () => {
        const tree = buildKeyTree(keys);
        const a = tree.find((n) => n.name === 'a');
        expect(a?.kind).toBe('folder');
        expect(a?.count).toBe(3);
        expect(tree.find((n) => n.name === 'solo')).toMatchObject({
            kind: 'key',
            key: 'solo'
        });
    });
    it('flattens only expanded folders, with depth', () => {
        const tree = buildKeyTree(keys);
        expect(flattenTree(tree, new Set()).map((r) => r.name)).toEqual([
            'a',
            'solo'
        ]);
        const rows = flattenTree(tree, new Set(['a', 'a:b']));
        expect(rows.map((r) => [r.name, r.depth])).toEqual([
            ['a', 0],
            ['b', 1],
            ['1', 2],
            ['2', 2],
            ['c', 1],
            ['solo', 0]
        ]);
    });
    it('a key that is also a prefix stays a key and a folder', () => {
        const tree = buildKeyTree(['a', 'a:b']);
        expect(tree.map((n) => n.kind).sort()).toEqual(['folder', 'key']);
    });
});
