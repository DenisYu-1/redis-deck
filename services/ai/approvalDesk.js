// Writes of the assistant that wait for the user's answer to their approval
// card. In memory: a restart ends the turns that were waiting.
const waiting = new Map(); // card id -> { chatId, settle(answer) }

// Resolves 'once' on Approve; 'deny' on Deny and once any of the signals
// aborts (approval timeout, the chat's request gone).
function awaitAnswer({ chatId, id }, signals) {
    const signal = AbortSignal.any(signals.filter(Boolean));
    if (signal.aborted) return Promise.resolve('deny');
    return new Promise((resolve) => {
        const settle = (answer) => {
            waiting.delete(id);
            signal.removeEventListener('abort', deny);
            resolve(answer);
        };
        const deny = () => settle('deny');
        signal.addEventListener('abort', deny);
        waiting.set(id, { chatId, settle });
    });
}

// The user's answer. false when nothing waits for it (any more).
function answerApproval({ chatId, id, approved }) {
    const entry = waiting.get(id);
    if (!entry || entry.chatId !== chatId) return false;
    entry.settle(approved ? 'once' : 'deny');
    return true;
}

module.exports = { awaitAnswer, answerApproval };
