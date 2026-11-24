// Tier defaults of AI access for a new Connection (ADR 0005). No imports, so
// services/database.js can use it without a require cycle.
function defaultAccess({ tier, readOnly }) {
    const local = tier === 'local';
    return {
        keys: true,
        values: tier !== 'production',
        write: local && !readOnly,
        workflows: local && !readOnly,
        ask: !local
    };
}

module.exports = { defaultAccess };
