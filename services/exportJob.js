// Export job (SPEC R7): Keys are read a chunk at a time, one scan page at a
// time, and the job holds at most MAX_EXPORT exported entries.
const bulkKeys = require('./bulkKeys');
const { scanPages } = require('./scanPages');
const { startJob } = require('./jobs');

const CHUNK = 100;

const bad = (message) =>
    Object.assign(new Error(message), { status: 400, code: 'BAD_REQUEST' });

// Exports keys into out until the cap; -> false to stop scanning.
async function exportChunks(env, keys, out, { progress, cancelled }) {
    for (let i = 0; i < keys.length; i += CHUNK) {
        if (cancelled()) return false;
        const room = bulkKeys.MAX_EXPORT - out.length;
        if (room <= 0) {
            progress.truncated = true;
            return false;
        }
        const chunk = keys.slice(i, i + Math.min(CHUNK, room));
        out.push(...(await bulkKeys.exportKeys(env, chunk)));
        progress.scanned += chunk.length;
        progress.exported = out.length;
    }
    return true;
}

// target: { pattern, type? } or { keys } (at most MAX_EXPORT). -> the job view.
function startExportJob(env, { pattern, type, keys } = {}) {
    const selection =
        Array.isArray(keys) &&
        keys.length > 0 &&
        keys.every((k) => typeof k === 'string');
    if (!selection && !(typeof pattern === 'string' && pattern)) {
        throw bad('Send a pattern or a non-empty keys array');
    }
    if (selection && keys.length > bulkKeys.MAX_EXPORT) {
        throw bad(
            `Cannot export more than ${bulkKeys.MAX_EXPORT} keys at once`
        );
    }
    const progress = { scanned: 0, exported: 0, truncated: false };
    return startJob('export', env, progress, async (ctx) => {
        const out = [];
        if (selection) {
            await exportChunks(env, keys, out, ctx);
        } else {
            await scanPages(env, { pattern, type }, ctx.cancelled, (page) =>
                exportChunks(env, page.keys, out, ctx)
            );
        }
        return out;
    });
}

module.exports = { startExportJob };
