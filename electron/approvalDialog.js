// Native approval dialog for MCP writes on Confirm writes Connections: the
// production approver passed to startStdio by --mcp. Deny is the default and
// cancel button; closing the dialog or 60 s with no answer is Deny. The dock
// icon shows only while a dialog is open.
const { app, dialog } = require('electron');
const { APPROVAL_TIMEOUT_MS } = require('../services/mcp/approvals');

const ANSWERS = ['deny', 'once', 'session'];
let openDialogs = 0;

async function approvalDialog({
    clientName,
    connectionId,
    tier,
    operation,
    key
}) {
    openDialogs += 1;
    if (openDialogs === 1) {
        await app.dock?.show();
    }
    app.focus({ steal: true });
    try {
        const { response } = await dialog.showMessageBox({
            type: 'warning',
            title: 'Redis Deck: approve AI write',
            message: `${clientName} wants to run ${operation} on Connection "${connectionId}" (${tier}).`,
            detail: key ? `Key: ${key}` : undefined,
            buttons: ['Deny', 'Allow once', 'Allow for this session'],
            defaultId: 0,
            cancelId: 0,
            noLink: true,
            signal: AbortSignal.timeout(APPROVAL_TIMEOUT_MS)
        });
        return ANSWERS[response] ?? 'deny';
    } finally {
        openDialogs -= 1;
        if (openDialogs === 0) {
            app.dock?.hide();
        }
    }
}

module.exports = { approvalDialog };
