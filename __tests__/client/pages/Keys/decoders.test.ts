import {
    decodeValue,
    detectFormat,
    phpUnserialize
} from '@/pages/Keys/decoders';

describe('phpUnserialize', () => {
    test('scalars', () => {
        expect(phpUnserialize('N;')).toBeNull();
        expect(phpUnserialize('b:1;')).toBe(true);
        expect(phpUnserialize('i:-42;')).toBe(-42);
        expect(phpUnserialize('d:1.5;')).toBe(1.5);
        expect(phpUnserialize('s:5:"hello";')).toBe('hello');
    });

    test('string length counts bytes, not characters', () => {
        expect(phpUnserialize('s:2:"é";')).toBe('é');
    });

    test('lists become arrays, maps become objects', () => {
        expect(phpUnserialize('a:2:{i:0;s:1:"a";i:1;i:7;}')).toEqual(['a', 7]);
        expect(
            phpUnserialize('a:2:{s:1:"k";a:1:{i:0;b:0;}s:1:"n";N;}')
        ).toEqual({ k: [false], n: null });
    });

    test('objects keep their class name', () => {
        expect(phpUnserialize('O:3:"Foo":1:{s:1:"a";i:1;}')).toEqual({
            __class: 'Foo',
            a: 1
        });
    });

    test('invalid input throws', () => {
        expect(() => phpUnserialize('s:9:"short";')).toThrow();
        expect(() => phpUnserialize('hello')).toThrow();
        expect(() => phpUnserialize('i:1;trailing')).toThrow();
    });
});

describe('detectFormat', () => {
    test.each([
        ['{"a":1}', 'json'],
        ['[1,2]', 'json'],
        ['a:1:{i:0;i:1;}', 'php'],
        ['plain text', 'raw'],
        ['123', 'raw'],
        ['{broken', 'raw']
    ])('%s -> %s', (input, expected) => {
        expect(detectFormat(input)).toBe(expected);
    });
});

describe('decodeValue', () => {
    test('auto pretty-prints JSON', () => {
        expect(decodeValue('{"a":[1]}', 'auto')).toEqual({
            format: 'json',
            ok: true,
            text: '{\n  "a": [\n    1\n  ]\n}'
        });
    });

    test('auto decodes PHP-serialized data to JSON text', () => {
        const out = decodeValue('a:1:{s:1:"a";i:1;}', 'auto');
        expect(out.format).toBe('php');
        expect(JSON.parse(out.text)).toEqual({ a: 1 });
    });

    test('raw returns the input untouched', () => {
        expect(decodeValue('{"a":1}', 'raw')).toEqual({
            format: 'raw',
            ok: true,
            text: '{"a":1}'
        });
    });

    test('forcing a decoder on invalid data falls back to raw, flagged', () => {
        expect(decodeValue('nope', 'json')).toEqual({
            format: 'json',
            ok: false,
            text: 'nope'
        });
        expect(decodeValue('nope', 'php').ok).toBe(false);
    });
});
