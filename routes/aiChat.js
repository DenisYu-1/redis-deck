// One turn of the AI assistant, streamed to the browser as one JSON event per
// line (see services/ai/turnRunner.js). The server keeps no chat history: the
// browser sends the whole transcript every turn.
const express = require('express');
const { getConnection } = require('../services/database');
const { getChatModel } = require('../services/aiModel');
const { runTurn } = require('../services/ai/turnRunner');
const { isChips, withChips } = require('../services/ai/chips');

const router = express.Router();

// Chats with a turn in progress.
const running = new Set();

const isMessage = (m) =>
    (m?.role === 'user' || m?.role === 'assistant') &&
    typeof m.text === 'string' &&
    isChips(m.chips);

// Returns why the request cannot be run, or null.
function invalid({ chatId, connectionId, messages } = {}) {
    if (typeof chatId !== 'string' || !chatId) return 'chatId is required';
    if (typeof connectionId !== 'string' || !getConnection(connectionId)) {
        return 'Unknown Connection';
    }
    if (!Array.isArray(messages) || !messages.every(isMessage)) {
        return 'messages must be a list of { role, text, chips? }';
    }
    if (messages.at(-1)?.role !== 'user') {
        return 'The last message must be the user’s';
    }
    return null;
}

router.post('/ai-chat', async (req, res) => {
    const problem = invalid(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const model = getChatModel();
    if (!model) {
        return res.status(400).json({ error: 'No model is set up yet' });
    }
    const { chatId, connectionId, messages } = req.body;
    if (running.has(chatId)) {
        return res
            .status(409)
            .json({ error: 'The assistant is still answering in this chat' });
    }

    running.add(chatId);
    // Closing the chat's request (New chat, reload) stops the turn.
    const left = new AbortController();
    res.on('close', () => left.abort());
    res.writeHead(200, {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();
    try {
        await runTurn({
            connectionId,
            messages: messages.map(({ role, text, chips }) => ({
                role,
                text: withChips(text, chips)
            })),
            model,
            signal: left.signal,
            emit: (event) => {
                if (!res.destroyed) res.write(`${JSON.stringify(event)}\n`);
            }
        });
    } catch (error) {
        console.error('AI chat turn failed:', error.message);
    } finally {
        running.delete(chatId);
        res.end();
    }
});

module.exports = router;
