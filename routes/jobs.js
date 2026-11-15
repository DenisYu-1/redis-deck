// Server jobs (SPEC R7): start, poll, cancel. In memory; lost on restart.
const express = require('express');
const router = express.Router();
const { writeGuard } = require('../guards/writeGuard');
const { getConnection } = require('../services/database');
const {
    getJob,
    listJobs,
    cancelJob,
    getJobResult
} = require('../services/jobs');
const { startDeleteJob } = require('../services/deleteJob');
const { startExportJob } = require('../services/exportJob');

const fail = (res, error) =>
    res.status(error.status || 500).json({ error: error.message });

const notFound = (res) => res.status(404).json({ error: 'Job not found' });

// ?env= must name a saved Connection before a job starts on it.
function requireConnection(req, res, next) {
    const env = req.query.env;
    if (!env || typeof env !== 'string') {
        return res.status(400).json({ error: 'env is required' });
    }
    if (!getConnection(env)) {
        return res.status(404).json({ error: `Unknown connection '${env}'` });
    }
    next();
}

// body: { pattern, type? } or { keys }. Writes, so guarded at creation.
router.post('/jobs/delete', requireConnection, writeGuard(), (req, res) => {
    try {
        res.status(202).json(startDeleteJob(req.query.env, req.body));
    } catch (error) {
        fail(res, error);
    }
});

// body: { pattern, type? } or { keys }. A read, so no guard.
router.post('/jobs/export', requireConnection, (req, res) => {
    try {
        res.status(202).json(startExportJob(req.query.env, req.body));
    } catch (error) {
        fail(res, error);
    }
});

// ?env=&kind= -> newest first, so a page can pick up a job after navigating.
router.get('/jobs', (req, res) => {
    res.json({ jobs: listJobs({ env: req.query.env, kind: req.query.kind }) });
});

router.get('/jobs/:id', (req, res) => {
    const job = getJob(req.params.id);
    return job ? res.json(job) : notFound(res);
});

// The finished job's result as a download; 409 until it is done.
router.get('/jobs/:id/result', (req, res) => {
    const found = getJobResult(req.params.id);
    if (!found) return notFound(res);
    if (found.job.state !== 'done') {
        return res
            .status(409)
            .json({ error: `Job is ${found.job.state}, no result` });
    }
    res.attachment(`redis-${found.job.kind}-${found.job.env}.json`);
    res.json(found.result);
});

router.post('/jobs/:id/cancel', (req, res) => {
    const job = cancelJob(req.params.id);
    return job ? res.json(job) : notFound(res);
});

module.exports = router;
