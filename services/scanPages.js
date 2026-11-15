// One scan page at a time for jobs (SPEC R7): memory stays constant.
const { scanClusterNodes } = require('./redis');
const { getConnectionConfig } = require('./database');
const { scanBudget } = require('./scanBudget');

const nodeFailure = (failedNodes) =>
    Object.assign(
        new Error(
            `Could not scan ${failedNodes.map((n) => n.address).join(', ')}; stopped`
        ),
        { details: { failedNodes } }
    );

// onPage(page) runs per page; it may return false to stop early.
async function scanPages(env, { pattern, type }, cancelled, onPage) {
    const { maxCount } = scanBudget(getConnectionConfig(env)?.tier);
    let cursors = ['0'];
    let hasMore = true;
    while (hasMore && !cancelled()) {
        const page = await scanClusterNodes(
            pattern,
            cursors,
            maxCount,
            env,
            type || null
        );
        // A failed Node keeps its cursor forever; stop instead of looping.
        if (page.failedNodes.length > 0) {
            throw nodeFailure(page.failedNodes);
        }
        if (cancelled() || (await onPage(page)) === false) return;
        cursors = page.cursors;
        hasMore = page.hasMore;
    }
}

module.exports = { scanPages };
