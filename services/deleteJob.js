// Bulk delete job (SPEC R7): one scan page at a time, so memory stays
// constant. Clustered pages are deleted with one redis-cli stdin session per
// primary Node that returned the Keys (ADR 0002).
const { isClusterMode, execArgvBatch } = require('./redis');
const { scanPages } = require('./scanPages');
const bulkKeys = require('./bulkKeys');
const keyStore = require('./keyStore');
const { startJob } = require('./jobs');

const SELECTION_CHUNK = 100;

// keyNodes (clustered pages only): Key -> the primary Node whose SCAN
// returned it. -> Map(node -> keys).
function groupByNode(keys, keyNodes) {
    const groups = new Map();
    for (const key of keys) {
        const node = keyNodes[key];
        if (!groups.has(node)) groups.set(node, []);
        groups.get(node).push(key);
    }
    return groups;
}

// -> number of Keys removed on this page.
async function deletePage(env, page) {
    if (!page.keyNodes) {
        return page.keys.length ? bulkKeys.deleteKeys(env, page.keys) : 0;
    }
    let deleted = 0;
    for (const [node, keys] of groupByNode(page.keys, page.keyNodes)) {
        const replies = await execArgvBatch(
            keys.map((k) => ['UNLINK', k]),
            env,
            node
        );
        deleted += replies.filter((r) => r.value === 1).length;
    }
    return deleted;
}

async function byPattern(env, target, { progress, cancelled }) {
    await scanPages(env, target, cancelled, async (page) => {
        progress.scanned += page.keys.length;
        if (cancelled()) return false;
        progress.deleted += await deletePage(env, page);
    });
}

async function bySelection(env, keys, { progress, cancelled }) {
    const clustered = await isClusterMode(env);
    for (let i = 0; i < keys.length && !cancelled(); i += SELECTION_CHUNK) {
        const chunk = keys.slice(i, i + SELECTION_CHUNK);
        if (clustered) {
            // Owner unknown: MOVED routes each Key to its primary.
            for (const key of chunk) {
                if (cancelled()) return;
                progress.deleted += (await keyStore.deleteKey(env, key)) || 0;
                progress.scanned++;
            }
        } else {
            progress.deleted += await bulkKeys.deleteKeys(env, chunk);
            progress.scanned += chunk.length;
        }
    }
}

const bad = (message) =>
    Object.assign(new Error(message), { status: 400, code: 'BAD_REQUEST' });

// target: { pattern, type? } or { keys }. -> the job view.
function startDeleteJob(env, { pattern, type, keys } = {}) {
    const selection =
        Array.isArray(keys) &&
        keys.length > 0 &&
        keys.every((k) => typeof k === 'string');
    if (!selection && !(typeof pattern === 'string' && pattern)) {
        throw bad('Send a pattern or a non-empty keys array');
    }
    const progress = { scanned: 0, deleted: 0 };
    return startJob('delete', env, progress, (ctx) =>
        selection
            ? bySelection(env, keys, ctx)
            : byPattern(env, { pattern, type }, ctx)
    );
}

module.exports = { startDeleteJob };
