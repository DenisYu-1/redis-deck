/** @jest-environment node */
const request = require('supertest');
const { createApp } = require('../../config/app');
const { db } = require('../../services/database');

describe('AI hidden fields routes', () => {
    const app = createApp();

    beforeEach(() => {
        db.prepare("DELETE FROM settings WHERE key = 'hidden_fields'").run();
    });

    afterEach(() => {
        db.prepare("DELETE FROM settings WHERE key = 'hidden_fields'").run();
    });

    test('defaults to password, token, secret', async () => {
        const res = await request(app).get('/api/ai-hidden-fields');
        expect(res.body).toEqual({ fields: ['password', 'token', 'secret'] });
    });

    test('PUT saves the list, trimmed and lowercased', async () => {
        const put = await request(app)
            .put('/api/ai-hidden-fields')
            .send({ fields: [' SSN ', 'token'] });
        expect(put.status).toBe(200);
        const res = await request(app).get('/api/ai-hidden-fields');
        expect(res.body.fields).toEqual(['ssn', 'token']);
    });

    test('an empty list is allowed', async () => {
        await request(app).put('/api/ai-hidden-fields').send({ fields: [] });
        const res = await request(app).get('/api/ai-hidden-fields');
        expect(res.body.fields).toEqual([]);
    });

    test.each([
        [{ fields: ['a', ''] }],
        [{ fields: ['a', ' '] }],
        [{ fields: ['a', 'A'] }],
        [{ fields: 'a' }],
        [{ fields: [1] }],
        [{}]
    ])('rejects %j', async (body) => {
        const res = await request(app).put('/api/ai-hidden-fields').send(body);
        expect(res.status).toBe(400);
    });
});
