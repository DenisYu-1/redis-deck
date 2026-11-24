/** @jest-environment node */
const request = require('supertest');
const { createApp } = require('../../config/app');
const { db } = require('../../services/database');

const byName = (body) => Object.fromEntries(body.tools.map((t) => [t.name, t]));

describe('AI tool switch routes', () => {
    const app = createApp();

    beforeEach(() => db.prepare('DELETE FROM settings').run());

    it('lists registered tools with write tags and default switches', async () => {
        const { body } = await request(app).get('/api/ai-tools').expect(200);
        const tools = byName(body);
        expect(tools.get_key).toMatchObject({ write: false, enabled: true });
        expect(tools.get_key.description).toEqual(expect.any(String));
        expect(tools.set_key).toMatchObject({ write: true, enabled: true });
        expect(tools.run_workflow).toMatchObject({
            write: true,
            enabled: false
        });
    });

    it('sets a switch and reads it back', async () => {
        await request(app)
            .put('/api/ai-tools/get_key')
            .send({ enabled: false })
            .expect(200);
        await request(app)
            .put('/api/ai-tools/run_workflow')
            .send({ enabled: true })
            .expect(200);
        const { body } = await request(app).get('/api/ai-tools');
        expect(byName(body).get_key.enabled).toBe(false);
        expect(byName(body).run_workflow.enabled).toBe(true);
    });

    it('rejects an unknown tool and a non-boolean value', async () => {
        await request(app)
            .put('/api/ai-tools/nope')
            .send({ enabled: true })
            .expect(404);
        await request(app)
            .put('/api/ai-tools/get_key')
            .send({ enabled: 'yes' })
            .expect(400);
    });
});
