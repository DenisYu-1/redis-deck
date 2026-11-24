// Pieces every tool group shares: the connectionId argument and the target a
// write names (shown in the approval dialog and logged as AI activity).
const { z } = require('zod');

const connectionId = z.string().describe('Connection id from list_connections');

// target: { label, of(args) -> the Key or Workflow the call acts on }.
const keyTarget = { label: 'Key', of: (args) => args.key };
const workflowTarget = { label: 'Workflow', of: (args) => args.fullId };

module.exports = { connectionId, keyTarget, workflowTarget };
