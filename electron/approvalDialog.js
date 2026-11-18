// Native approval dialog for MCP writes on Confirm writes Connections: the
// production approver passed to startStdio by --mcp. Deny is the default and
// cancel button; closing the dialog is Deny, and the approval timeout
// (services/mcp/approvals.js) closes it through signal. The dock icon shows
// only while a dialog is open.
const { app, dialog } = require('electron');

const ANSWERS = ['deny', 'once', 'session'];
let openDialogs = 0;

async function approvalDialog(
    { clientName, connectionId, tier, operation, target, targetLabel },
    { signal }
) {
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
            detail: target ? `${targetLabel}: ${target}` : undefined,
            buttons: ['Deny', 'Allow once', 'Allow for this session'],
            defaultId: 0,
            cancelId: 0,
            noLink: true,
            signal
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
