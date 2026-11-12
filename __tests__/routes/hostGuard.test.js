const request = require('supertest');
const express = require('express');
const { hostGuard } = require('../../guards/hostGuard');

describe('hostGuard', () => {
    const app = express();
    app.use(hostGuard(() => 4321));
    app.get('/', (req, res) => res.send('ok'));

    it.each(['127.0.0.1:4321', 'localhost:4321', 'LocalHost:4321'])(
        'allows %s',
        async (host) => {
            await request(app).get('/').set('Host', host).expect(200);
        }
    );

    it.each([
        'evil.com',
        'evil.com:4321',
        '127.0.0.1:1',
        '127.0.0.1',
        'x.localhost:4321'
    ])('rejects %s', async (host) => {
        await request(app).get('/').set('Host', host).expect(403);
    });
});
