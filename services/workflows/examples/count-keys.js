// Example read-only Workflow handler: reports the key count.
module.exports = {
    async plan() {
        return { text: 'Would run DBSIZE' };
    },
    async run(_inputs, ctx) {
        const n = String(await ctx.exec('DBSIZE')).trim();
        return { text: `${n} keys in the current database` };
    }
};
