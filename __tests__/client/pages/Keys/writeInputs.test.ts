import { parseTtlInput, parseNewValue } from '@/pages/Keys/writeInputs';

describe('parseTtlInput', () => {
    test.each([
        ['90', 90],
        ['5m', 300],
        ['2h', 7200],
        ['1d', 86400],
        [' 30s ', 30],
        ['', -1],
        ['none', -1]
    ])('%j -> %j', (text, seconds) => {
        expect(parseTtlInput(text)).toBe(seconds);
    });

    test.each(['abc', '-5', '1.5h', '0'])('%j is invalid', (text) => {
        expect(parseTtlInput(text)).toBeNull();
    });
});

describe('parseNewValue', () => {
    test('string keeps text as is', () => {
        expect(parseNewValue('string', ' a b ')).toEqual({ value: ' a b ' });
    });
    test('hash reads field=value lines', () => {
        expect(parseNewValue('hash', 'a=1\nb=x=y\n')).toEqual({
            value: { a: '1', b: 'x=y' }
        });
        expect(parseNewValue('hash', 'nofield')).toHaveProperty('error');
    });
    test('list and set read one item per line', () => {
        expect(parseNewValue('list', 'a\n\nb')).toEqual({ value: ['a', 'b'] });
        expect(parseNewValue('set', 'a')).toEqual({ value: ['a'] });
    });
    test('zset reads "score member" lines', () => {
        expect(parseNewValue('zset', '1.5 foo bar\n2 x')).toEqual({
            value: [
                { member: 'foo bar', score: 1.5 },
                { member: 'x', score: 2 }
            ]
        });
        expect(parseNewValue('zset', 'x foo')).toHaveProperty('error');
    });
    test('empty value is an error', () => {
        expect(parseNewValue('list', '  \n')).toHaveProperty('error');
        expect(parseNewValue('string', '')).toHaveProperty('error');
    });
});
