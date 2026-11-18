// Write tools: change Redis, so invoke() runs the MCP write guard before each.
// Each one calls keyStore directly; nothing here may flush, bulk-delete by Key
// pattern, touch Connection config or run a caller-supplied command.
const { z } = require('zod');
const {
    run,
    writeKey,
    addMember,
    deleteKey,
    renameKey,
    expireKey
} = require('../../keyStore');

const { connectionId, keyTarget } = require('./shared');
const key = z.string().min(1).describe('Exact Key name');

const setKey = {
    name: 'set_key',
    access: 'write',
    target: keyTarget,
    description:
        'Create or replace a whole Key. type picks the value shape: string -> a string; hash -> { field: value }; list / set -> [string]; zset -> [{ member, score }]. ttl > 0 sets an expiry in seconds. To change one member, use zadd or set_hash_field instead.',
    inputSchema: {
        connectionId,
        key,
        type: z
            .enum(['string', 'hash', 'list', 'set', 'zset'])
            .default('string'),
        value: z.union([
            z.string(),
            z.record(z.string(), z.string()),
            z.array(z.string()),
            z.array(z.object({ member: z.string(), score: z.number() }))
        ]),
        ttl: z.number().int().nonnegative().default(0)
    },
    run: async ({ connectionId: id, key: k, type, value, ttl }) => {
        await writeKey(id, k, type, value, ttl);
        return { key: k, type, written: true };
    }
};

const deleteKeyTool = {
    name: 'delete_key',
    access: 'write',
    target: keyTarget,
    description: 'Delete one Key. deleted: false means it did not exist.',
    inputSchema: { connectionId, key },
    run: async ({ connectionId: id, key: k }) => ({
        key: k,
        deleted: (await deleteKey(id, k)) > 0
    })
};

const renameKeyTool = {
    name: 'rename_key',
    access: 'write',
    target: keyTarget,
    description:
        'Rename a Key (RENAME): an existing Key named newKey is overwritten.',
    inputSchema: {
        connectionId,
        key,
        newKey: z.string().min(1).describe('New Key name')
    },
    run: async ({ connectionId: id, key: k, newKey }) => {
        await renameKey(id, k, newKey);
        return { key: k, newKey, renamed: true };
    }
};

const setTtl = {
    name: 'set_ttl',
    access: 'write',
    target: keyTarget,
    description: 'Set a Key to expire in seconds.',
    inputSchema: {
        connectionId,
        key,
        seconds: z.number().int().positive()
    },
    run: async ({ connectionId: id, key: k, seconds }) => ({
        key: k,
        ttl: seconds,
        applied: (await expireKey(id, k, seconds)) === 1
    })
};

const removeTtl = {
    name: 'remove_ttl',
    access: 'write',
    target: keyTarget,
    description: 'Remove the expiry of a Key so it never expires.',
    inputSchema: { connectionId, key },
    run: async ({ connectionId: id, key: k }) => ({
        key: k,
        // PERSIST is 0 for a missing Key or one without an expiry.
        removed: (await expireKey(id, k, -1)) === 1
    })
};

const zadd = {
    name: 'zadd',
    access: 'write',
    target: keyTarget,
    description:
        'Add members to a sorted set in place (ZADD); an existing member gets the new score, other members and the TTL stay. Creates the Key if missing. added counts new members only.',
    inputSchema: {
        connectionId,
        key,
        members: z
            .array(z.object({ member: z.string(), score: z.number() }))
            .min(1)
    },
    run: async ({ connectionId: id, key: k, members }) => {
        const pairs = members.flatMap((m) => [m.score, m.member]);
        const { result } = await run(id, ['ZADD', k, ...pairs]);
        return { key: k, added: Number(result) };
    }
};

const setHashField = {
    name: 'set_hash_field',
    access: 'write',
    target: keyTarget,
    description:
        'Set one field of a hash Key in place (HSET); other fields and the TTL stay. Creates the hash if missing.',
    inputSchema: {
        connectionId,
        key,
        field: z.string().min(1),
        value: z.string()
    },
    run: async ({ connectionId: id, key: k, field, value }) => {
        await addMember(id, k, { field, value });
        return { key: k, field, written: true };
    }
};

module.exports = [
    setKey,
    deleteKeyTool,
    renameKeyTool,
    setTtl,
    removeTtl,
    zadd,
    setHashField
];
