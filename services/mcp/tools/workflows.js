// Workflow tools: the same registry and runner as the Workflows page, so runs
// land in the same run history. Running is always a guarded write (whatever
// the action's `writes` flag says); planning is a dry run, so it is a read.
const { z } = require('zod');
const workflows = require('../../workflows');
const { getConnection } = require('../../database');

const { connectionId, workflowTarget } = require('./shared');
const fullId = z.string().describe('Workflow fullId from list_workflows');
const inputs = z
    .record(z.string(), z.union([z.string(), z.number()]))
    .default({})
    .describe('Input values by input name; defaults fill the rest');

// The Workflow and Connection a plan or run acts on; throws if either is unknown.
function resolve(args) {
    const workflow = workflows.findWorkflow(args.fullId);
    if (!workflow) {
        throw new Error(`Unknown Workflow '${args.fullId}'`);
    }
    const connection = getConnection(args.connectionId);
    if (!connection) {
        throw new Error(`Connection '${args.connectionId}' not found`);
    }
    return { workflow, connection };
}

const toInput = (input) => ({
    name: input.name,
    label: input.label,
    type: input.type ?? 'text',
    required: Boolean(input.required),
    ...(input.def !== undefined && { default: input.def }),
    ...(input.options && {
        options: input.options.map((o) => String(o.value ?? o))
    }),
    ...(input.hint && { hint: input.hint })
});

const listWorkflows = {
    name: 'list_workflows',
    access: 'read',
    description:
        'List the Workflows (prepared plan/run actions) with their inputs. Use the fullId with plan_workflow and run_workflow.',
    inputSchema: {},
    run: async () => ({
        workflows: workflows.listWorkflows().flatMap((plugin) =>
            plugin.actions.map((action) => ({
                fullId: action.fullId,
                plugin: plugin.name,
                title: action.title,
                description: action.desc,
                writes: action.writes,
                inputs: action.inputs.map(toInput)
            }))
        )
    })
};

const planWorkflow = {
    name: 'plan_workflow',
    access: 'read',
    description:
        'Dry-run a Workflow: validates the inputs and says what run_workflow would do, without changing Redis.',
    inputSchema: { connectionId, fullId, inputs },
    run: async (args) => {
        const { workflow, connection } = resolve(args);
        return workflows.plan(
            workflow,
            args.connectionId,
            args.inputs,
            connection
        );
    }
};

// A failed run is still recorded in the run history, then fails the call.
const runWorkflow = {
    name: 'run_workflow',
    access: 'write',
    target: workflowTarget,
    description:
        'Run a Workflow on a Connection. It may change Redis; use plan_workflow first to preview.',
    inputSchema: { connectionId, fullId, inputs },
    // A Workflow's commands are code: the card shows the run and its inputs.
    card: {
        title: (args) => `Run Workflow ${args.fullId}`,
        commands: (args) => [
            [
                'run_workflow',
                args.fullId,
                ...Object.entries(args.inputs).map(([k, v]) => `${k}=${v}`)
            ]
        ],
        done: (result) => result.text
    },
    run: async (args) => {
        const { workflow, connection } = resolve(args);
        const result = await workflows.run(
            workflow,
            args.connectionId,
            args.inputs,
            connection
        );
        if (!result.ok) {
            throw new Error(result.text);
        }
        return { text: result.text, inputs: result.inputs };
    }
};

module.exports = [listWorkflows, planWorkflow, runWorkflow];
