const request = require('supertest');
const { createApp } = require('../../config/app');
const { getDatabase } = require('../../services/database');

describe('Stats Routes', () => {
    const app = createApp();
    const id = global.TEST_CONNECTION_ID;

    afterEach(() => {
        getDatabase()
            .prepare('DELETE FROM stats_snapshots WHERE connection_id = ?')
            .run(id);
    });

    describe('GET /api/stats/history', () => {
        test('rows expose the field names the UI consumes', async () => {
            const now = Math.floor(Date.now() / 1000);
            getDatabase()
                .prepare(
                    `INSERT INTO stats_snapshots (connection_id, timestamp, used_memory,
                        used_memory_peak, ops_per_sec, used_cpu_sys, used_cpu_user, total_keys)
                     VALUES (?, ?, 1000, 2000, 42, 1.5, 2.5, 7)`
                )
                .run(id, now - 60);

            const res = await request(app)
                .get('/api/stats/history')
                .query({ env: id, hours: 1 })
                .expect(200);

            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0]).toMatchObject({
                memory_used: 1000,
                memory_peak: 2000,
                instantaneous_ops_per_sec: 42,
                used_cpu_sys: 1.5,
                used_cpu_user: 2.5,
                total_keys: 7
            });
        });
    });
});
