/** @jest-environment node */
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../../config/app');
const { createInstaller } = require('../../services/aiClients/installer');

describe('AI client installer routes', () => {
    let home;
    let app;

    beforeEach(() => {
        home = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-home-'));
        app = createApp({
            aiClients: createInstaller({
                home,
                command: '/bin/redis-deck',
                args: ['--mcp']
            })
        });
    });
    afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

    const claudeCode = async () =>
        (
            await request(app).get('/api/ai-clients').expect(200)
        ).body.clients.find((c) => c.id === 'claude-code');

    it('installs, lists and removes Claude Code', async () => {
        expect((await claudeCode()).status).toBe('not-installed');

        await request(app)
            .post('/api/ai-clients/claude-code/install')
            .expect(200);
        expect((await claudeCode()).status).toBe('installed');

        await request(app)
            .post('/api/ai-clients/claude-code/remove')
            .expect(200);
        expect((await claudeCode()).status).toBe('not-installed');
    });

    it('returns the Manual setup snippet', async () => {
        const res = await request(app)
            .get('/api/ai-clients/claude-code/snippet')
            .expect(200);

        expect(res.body.path).toBe(path.join(home, '.claude.json'));
        expect(JSON.parse(res.body.text).mcpServers['redis-deck'].command).toBe(
            '/bin/redis-deck'
        );
    });

    it('404s an unknown AI client', async () => {
        const res = await request(app)
            .post('/api/ai-clients/nope/install')
            .expect(404);
        expect(res.body.error).toMatch(/Unknown AI client/);
    });

    it('is not mounted outside the Desktop app', async () => {
        await request(createApp())
            .post('/api/ai-clients/claude-code/install')
            .expect(404);
        expect(fs.existsSync(path.join(home, '.claude.json'))).toBe(false);
    });
});
