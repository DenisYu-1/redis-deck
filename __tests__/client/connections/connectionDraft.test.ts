import {
    blankDraft,
    draftFromConnection,
    draftToPayload,
    moveItem
} from '@/pages/Connections/connectionDraft';
import type { RedisConnection } from '@/types';

const saved: RedisConnection = {
    id: 'prod',
    host: 'h',
    port: 6380,
    username: 'bob',
    tls: true,
    cluster: false,
    tier: 'production',
    db: 2,
    verifyTls: false,
    readOnly: true,
    confirmWrites: true,
    hasPassword: true
};

describe('connection draft', () => {
    test('blank draft is a local, verified, unguarded connection', () => {
        expect(blankDraft()).toMatchObject({
            id: '',
            tier: 'local',
            port: '6379',
            db: '0',
            tls: false,
            verifyTls: true,
            readOnly: false,
            confirmWrites: false,
            password: '',
            hasPassword: false
        });
    });

    test('draft from a saved connection never holds a password', () => {
        const d = draftFromConnection(saved);
        expect(d.password).toBe('');
        expect(d.hasPassword).toBe(true);
        expect(d.port).toBe('6380');
        expect(d.db).toBe('2');
        expect(d.isNew).toBe(false);
    });

    test('payload omits a blank password so the server keeps the stored one', () => {
        const payload = draftToPayload(draftFromConnection(saved));
        expect(payload).not.toHaveProperty('password');
        expect(payload).toMatchObject({
            id: 'prod',
            port: 6380,
            db: 2,
            tier: 'production',
            readOnly: true,
            confirmWrites: true,
            verifyTls: false
        });
    });

    test('payload carries a typed password', () => {
        const d = { ...draftFromConnection(saved), password: 'new' };
        expect(draftToPayload(d).password).toBe('new');
    });
});

describe('moveItem', () => {
    test('moves an item to a new index without mutating the input', () => {
        const input = ['a', 'b', 'c', 'd'];
        expect(moveItem(input, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
        expect(moveItem(input, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
        expect(input).toEqual(['a', 'b', 'c', 'd']);
    });
});
