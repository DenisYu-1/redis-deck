// In-memory job registry (SPEC R7). Jobs are lost on restart by design.
// A job is { id, kind, env, state, progress, error?, startedAt, finishedAt? };
// state: running -> done | cancelled | failed. `progress` is the worker's own
// counters object, mutated in place and read by pollers.
const { randomUUID } = require('crypto');

const KEEP_FINISHED_MS = 60 * 60 * 1000;
const MAX_FINISHED = 50;

const jobs = new Map(); // id -> { job, cancelRequested, result? }

function view({ job }) {
    return { ...job, progress: { ...job.progress } };
}

// Forget old finished jobs so the registry stays small.
function prune() {
    const finished = [...jobs.values()].filter(
        (e) => e.job.state !== 'running'
    );
    const cutoff = Date.now() - KEEP_FINISHED_MS;
    finished.forEach((e, i) => {
        if (
            e.job.finishedAt < cutoff ||
            i < finished.length - MAX_FINISHED
        ) {
            jobs.delete(e.job.id);
        }
    });
}

// work({ progress, cancelled }) runs in the background. It stops early when
// cancelled() turns true; a thrown error fails the job, and its `details`
// (if any) are kept on the job, e.g. failedNodes. What work resolves to is
// kept as the job's result (served by getJobResult) only if it finishes done.
function startJob(kind, env, progress, work) {
    prune();
    const entry = {
        job: {
            id: randomUUID(),
            kind,
            env,
            state: 'running',
            progress,
            startedAt: Date.now()
        },
        cancelRequested: false
    };
    jobs.set(entry.job.id, entry);
    const finish = (state, extra = {}) =>
        Object.assign(entry.job, { state, finishedAt: Date.now() }, extra);
    Promise.resolve()
        .then(() =>
            work({ progress, cancelled: () => entry.cancelRequested })
        )
        .then(
            (result) => {
                if (entry.cancelRequested) return finish('cancelled');
                entry.result = result;
                finish('done');
            },
            (error) =>
                finish('failed', {
                    error: error?.message || String(error),
                    ...error?.details
                })
        );
    return view(entry);
}

function getJob(id) {
    const entry = jobs.get(id);
    return entry ? view(entry) : null;
}

// Newest first.
function listJobs({ env, kind } = {}) {
    return [...jobs.values()]
        .filter(
            (e) =>
                (!env || e.job.env === env) && (!kind || e.job.kind === kind)
        )
        .map(view)
        .reverse();
}

// The worker sees it before its next step; state flips when it stops.
function cancelJob(id) {
    const entry = jobs.get(id);
    if (!entry) return null;
    if (entry.job.state === 'running') entry.cancelRequested = true;
    return view(entry);
}

// -> null (unknown), { job } (not done) or { job, result }.
function getJobResult(id) {
    const entry = jobs.get(id);
    if (!entry) return null;
    return entry.job.state === 'done'
        ? { job: view(entry), result: entry.result }
        : { job: view(entry) };
}

module.exports = { startJob, getJob, listJobs, cancelJob, getJobResult };
