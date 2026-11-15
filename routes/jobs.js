// Server jobs (SPEC R7): start, poll, cancel. In memory; lost on restart.
const express = require('express');
const router = express.Router();
const { writeGuard } = require('../guards/writeGuard');
const { getJob, listJobs, cancelJob } = require('../services/jobs');
const { startDeleteJob } = require('../services/deleteJob');

const fail = (res, error) =>
    res.status(error.status || 500).json({ error: error.message });

const notFound = (res) => res.status(404).json({ error: 'Job not found' });

// body: { pattern, type? } or { keys }. Writes, so guarded at creation.
router.post('/jobs/delete', writeGuard(), (req, res) => {
    try {
        res.status(202).json(startDeleteJob(req.query.env, req.body));
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

router.post('/jobs/:id/cancel', (req, res) => {
    const job = cancelJob(req.params.id);
    return job ? res.json(job) : notFound(res);
});

module.exports = router;
