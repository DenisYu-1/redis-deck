// Bulk delete job (SPEC R7): one scan page at a time, so memory stays
// constant. Clustered Keys are deleted with one redis-cli stdin session per
// primary Node that owns them (ADR 0002).
const { isClusterMode } = require('./redis');
const { scanPages } = require('./scanPages');
const { runOnOwners } = require('./perNode');
const bulkKeys = require('./bulkKeys');
const { startJob, jobTarget } = require('./jobs');

const SELECTION_CHUNK = 100;
const MAX_FAILED_KEYS = 20; // examples kept on the job; `failed` has the count

// Clustered: UNLINK per owner. Keys a reshard moved are retried once on the
// new owner; any Key still not deleted is counted (and sampled) as failed.
async function unlinkOnOwners(env, keys, keyNodes, progress) {
    const results = await runOnOwners(env, keys, keyNodes, (key) => [
        ['UNLINK', key]
    ]);
    for (const key of keys) {
        const { replies, error } = results[key];
        if (error) {
            progress.failed++;
            if (progress.failedKeys.length < MAX_FAILED_KEYS) {
                progress.failedKeys.push({ key, error });
            }
        } else if (replies[0] === 1) {
            progress.deleted++;
        }
    }
}

async function deleteKeys(env, keys, keyNodes, progress) {
    if (keys.length === 0) return;
    if (keyNodes) {
        await unlinkOnOwners(env, keys, keyNodes, progress);
    } else {
        progress.deleted += await bulkKeys.deleteKeys(env, keys);
    }
}

async function byPattern(env, target, { progress, cancelled }) {
    await scanPages(env, target, cancelled, async (page) => {
        progress.scanned += page.keys.length;
        if (cancelled()) return false;
        await deleteKeys(env, page.keys, page.keyNodes, progress);
    });
}

// Selected Keys come without a Node: on a cluster they start on the seed and
// MOVED replies route them to their owners, still batched per Node.
async function bySelection(env, keys, { progress, cancelled }) {
    const keyNodes = (await isClusterMode(env)) ? {} : null;
    for (let i = 0; i < keys.length && !cancelled(); i += SELECTION_CHUNK) {
        const chunk = keys.slice(i, i + SELECTION_CHUNK);
        await deleteKeys(env, chunk, keyNodes, progress);
        progress.scanned += chunk.length;
    }
}

// body: { pattern, type? } or { keys }. -> the job view.
function startDeleteJob(env, body) {
    const target = jobTarget(body);
    const progress = { scanned: 0, deleted: 0, failed: 0, failedKeys: [] };
    return startJob('delete', env, progress, (ctx) =>
        target.keys
            ? bySelection(env, target.keys, ctx)
            : byPattern(env, target, ctx)
    );
}

module.exports = { startDeleteJob };
