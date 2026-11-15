// Tier load budgets (SPEC R8): every scan loop pauses between SCAN hops and
// caps COUNT per hop by the Connection's Tier. Constants, not a setting.
const BUDGETS = {
    local: { pauseMs: 0, maxCount: 20000 },
    staging: { pauseMs: 5, maxCount: 20000 },
    production: { pauseMs: 20, maxCount: 5000 }
};

// Unknown or missing Tier is treated as local, matching normalizeTier().
function scanBudget(tier) {
    return BUDGETS[tier] || BUDGETS.local;
}

module.exports = { scanBudget };
