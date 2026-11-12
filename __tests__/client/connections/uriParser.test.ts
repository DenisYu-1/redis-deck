import { parseRedisUri } from '@/pages/Connections/uriParser';

describe('parseRedisUri', () => {
    test('parses a full redis URI', () => {
        expect(
            parseRedisUri('redis://alice:s3cret@cache.example.com:6380/3')
        ).toEqual({
            tls: false,
            username: 'alice',
            password: 's3cret',
            host: 'cache.example.com',
            port: 6380,
            db: 3
        });
    });

    test('rediss scheme turns TLS on', () => {
        expect(parseRedisUri('rediss://h:6379')).toMatchObject({
            tls: true,
            host: 'h'
        });
    });

    test('defaults port 6379 and db 0, no credentials', () => {
        expect(parseRedisUri('redis://localhost')).toEqual({
            tls: false,
            username: '',
            password: '',
            host: 'localhost',
            port: 6379,
            db: 0
        });
    });

    test('password-only userinfo has no username', () => {
        expect(parseRedisUri('redis://:pw@h')).toMatchObject({
            username: '',
            password: 'pw'
        });
    });

    test('percent-decodes credentials', () => {
        expect(parseRedisUri('redis://u%40x:p%3Aw%2F@h')).toMatchObject({
            username: 'u@x',
            password: 'p:w/'
        });
    });

    test('handles IPv6 hosts', () => {
        expect(parseRedisUri('redis://[::1]:7000/1')).toMatchObject({
            host: '::1',
            port: 7000,
            db: 1
        });
    });

    test('trims surrounding whitespace', () => {
        expect(parseRedisUri('  redis://h:1  ')).toMatchObject({
            host: 'h',
            port: 1
        });
    });

    test.each([
        '',
        'localhost:6379',
        'http://h:6379',
        'redis://',
        'redis://h:99999',
        'redis://h/abc'
    ])('returns null for invalid input %p', (input) => {
        expect(parseRedisUri(input)).toBeNull();
    });
});
