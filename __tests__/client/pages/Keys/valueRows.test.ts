import { filterRows, scoreDateHint, toRows } from '@/pages/Keys/valueRows';

describe('toRows', () => {
    test('hash -> field/value', () => {
        expect(toRows('hash', { a: '1', b: '2' })).toEqual([
            { id: 'a', label: 'a', value: '1' },
            { id: 'b', label: 'b', value: '2' }
        ]);
    });

    test('list -> index/value', () => {
        expect(toRows('list', ['x', 'y'])).toEqual([
            { id: '0', label: '0', value: 'x' },
            { id: '1', label: '1', value: 'y' }
        ]);
    });

    test('set -> members only, no label', () => {
        expect(toRows('set', ['m1'])).toEqual([{ id: 'm1', value: 'm1' }]);
    });

    test('zset -> member with score', () => {
        expect(toRows('zset', [{ member: 'm', score: '1.5' }])).toEqual([
            { id: 'm', value: 'm', score: '1.5' }
        ]);
    });

    test('unexpected shape yields no rows', () => {
        expect(toRows('hash', null)).toEqual([]);
        expect(toRows('list', 'oops')).toEqual([]);
    });
});

describe('filterRows', () => {
    const rows = toRows('hash', { Name: 'Ann', age: '3' });

    test('case-insensitive match on label or value', () => {
        expect(filterRows(rows, 'ann').map((r) => r.id)).toEqual(['Name']);
        expect(filterRows(rows, 'AGE').map((r) => r.id)).toEqual(['age']);
    });

    test('blank filter keeps everything', () => {
        expect(filterRows(rows, '  ')).toHaveLength(2);
    });
});

describe('scoreDateHint', () => {
    test('epoch seconds and milliseconds become UTC dates', () => {
        expect(scoreDateHint('1700000000')).toBe('2023-11-14 22:13:20 UTC');
        expect(scoreDateHint('1700000000000')).toBe('2023-11-14 22:13:20 UTC');
    });

    test('scores that are not plausible timestamps get no hint', () => {
        expect(scoreDateHint('42')).toBeNull();
        expect(scoreDateHint('abc')).toBeNull();
        expect(scoreDateHint('1.5')).toBeNull();
    });
});
