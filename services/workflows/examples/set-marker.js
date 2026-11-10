// Example Workflow handler: sets a marker key. Shows the plan/run contract.
const key = (inputs) => `workflow:example:${inputs.id}`;
const value = (inputs) => inputs.token || 'marker';

module.exports = {
    async plan(inputs) {
        return {
            text: `Would SET ${key(inputs)} to ${value(inputs)} with a ${inputs.ttl}s expiry`
        };
    },
    async run(inputs, ctx) {
        await ctx.exec(`SET ${key(inputs)} ${value(inputs)} EX ${inputs.ttl}`);
        return {
            text: `Set ${key(inputs)} to ${value(inputs)} (expires in ${inputs.ttl}s)`
        };
    }
};
