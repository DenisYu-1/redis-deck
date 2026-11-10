const express = require('express');
const router = express.Router();
const { getConnection, db } = require('../services/database');

function requireConnection(req, res, next) {
    if (!getConnection(req.params.id)) {
        return res
            .status(404)
            .json({ error: `Connection '${req.params.id}' not found` });
    }
    next();
}

router.get('/connections/:id/searches', requireConnection, (req, res) => {
    const searches = db
        .prepare(
            'SELECT id, name, pattern FROM saved_searches WHERE connection_id = ? ORDER BY id ASC'
        )
        .all(req.params.id);
    res.json({ searches });
});

router.post('/connections/:id/searches', requireConnection, (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const pattern = String(req.body?.pattern ?? '').trim();
    if (!name || !pattern) {
        return res.status(400).json({ error: 'name and pattern are required' });
    }
    const info = db
        .prepare(
            'INSERT INTO saved_searches (connection_id, name, pattern, created_at) VALUES (?, ?, ?, ?)'
        )
        .run(req.params.id, name, pattern, Date.now());
    res.status(201).json({
        search: { id: Number(info.lastInsertRowid), name, pattern }
    });
});

router.delete(
    '/connections/:id/searches/:searchId',
    requireConnection,
    (req, res) => {
        const info = db
            .prepare(
                'DELETE FROM saved_searches WHERE id = ? AND connection_id = ?'
            )
            .run(req.params.searchId, req.params.id);
        if (info.changes === 0) {
            return res.status(404).json({ error: 'Saved search not found' });
        }
        res.json({ message: 'Saved search deleted' });
    }
);

module.exports = router;
