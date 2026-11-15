// Export job (SPEC R7): Keys are read a chunk at a time, one scan page at a
// time, and the job holds at most MAX_EXPORT exported entries.
const bulkKeys = require('./bulkKeys');
const { scanPages } = require('./scanPages');
const { startJob, jobTarget, badRequest } = require('./jobs');

const CHUNK = 100;

// Exports keys into out until the cap; -> false to stop scanning.
// keyNodes: the scan page's Key -> Node map (clusters), if known.
async function exportChunks(env, keys, keyNodes, out, { progress, cancelled }) {
    for (let i = 0; i < keys.length; i += CHUNK) {
        if (cancelled()) return false;
        const room = bulkKeys.MAX_EXPORT - out.length;
        if (room <= 0) {
            progress.truncated = true;
            return false;
        }
        const chunk = keys.slice(i, i + Math.min(CHUNK, room));
        out.push(...(await bulkKeys.exportKeys(env, chunk, keyNodes)));
        progress.scanned += chunk.length;
        progress.exported = out.length;
    }
    return true;
}

// body: { pattern, type? } or { keys } (at most MAX_EXPORT). -> the job view.
function startExportJob(env, body) {
    const target = jobTarget(body);
    if (target.keys && target.keys.length > bulkKeys.MAX_EXPORT) {
        throw badRequest(
            `Cannot export more than ${bulkKeys.MAX_EXPORT} keys at once`
        );
    }
    const progress = { scanned: 0, exported: 0, truncated: false };
    return startJob('export', env, progress, async (ctx) => {
        const out = [];
        if (target.keys) {
            await exportChunks(env, target.keys, undefined, out, ctx);
        } else {
            await scanPages(env, target, ctx.cancelled, (page) =>
                exportChunks(env, page.keys, page.keyNodes, out, ctx)
            );
        }
        return out;
    });
}

module.exports = { startExportJob };
