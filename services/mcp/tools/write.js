// Write tools: change Redis, so invoke() runs the MCP write guard before each.
// Each one calls keyStore directly; nothing here may flush, bulk-delete by Key
// pattern, touch Connection config or run a caller-supplied command.
const { z } = require('zod');
const {
    run,
    writeCommands,
    writeKey,
    addMember,
    deleteKey,
    renameKey,
    expireKey
} = require('../../keyStore');

const { connectionId, keyTarget } = require('./shared');
const key = z.string().min(1).describe('Exact Key name');

// card: what a call would do, shown where the user is asked (writeCard.js):
// title(args), commands(args) -> argv lists, done(result).

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
    card: {
        title: (args) => `Set Key ${args.key}`,
        commands: ({ key: k, type, value, ttl }) =>
            writeCommands(k, type, value, ttl),
        done: () => 'Key written'
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
    card: {
        title: (args) => `Delete Key ${args.key}`,
        commands: (args) => [['DEL', args.key]],
        done: (result) =>
            result.deleted ? 'Key deleted' : 'The Key did not exist'
    },
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
    card: {
        title: (args) => `Rename Key ${args.key} to ${args.newKey}`,
        commands: (args) => [['RENAME', args.key, args.newKey]],
        done: () => 'Key renamed'
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
    card: {
        title: (args) => `Set a TTL of ${args.seconds} s on ${args.key}`,
        commands: (args) => [['EXPIRE', args.key, args.seconds]],
        done: (result) => (result.applied ? 'TTL set' : 'The Key did not exist')
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
    card: {
        title: (args) => `Remove the TTL of ${args.key}`,
        commands: (args) => [['PERSIST', args.key]],
        done: (result) =>
            result.removed ? 'TTL removed' : 'There was no TTL to remove'
    },
    run: async ({ connectionId: id, key: k }) => ({
        key: k,
        // PERSIST is 0 for a missing Key or one without an expiry.
        removed: (await expireKey(id, k, -1)) === 1
    })
};

const scorePairs = (members) => members.flatMap((m) => [m.score, m.member]);

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
    card: {
        title: (args) => `Add to the sorted set ${args.key}`,
        commands: (args) => [['ZADD', args.key, ...scorePairs(args.members)]],
        done: (result) => `${result.added} new members added`
    },
    run: async ({ connectionId: id, key: k, members }) => {
        const argv = ['ZADD', k, ...scorePairs(members)];
        const { result } = await run(id, argv);
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
    card: {
        title: (args) => `Set the field ${args.field} of ${args.key}`,
        commands: (args) => [['HSET', args.key, args.field, args.value]],
        done: () => 'Field set'
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
