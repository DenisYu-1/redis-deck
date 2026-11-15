// Tier load budgets (SPEC R8): pause between SCAN hops and max COUNT per hop.
const { scanBudget } = require('../../services/scanBudget');

describe('scanBudget', () => {
    test.each([
        ['local', 0, 20000],
        ['staging', 5, 20000],
        ['production', 20, 5000]
    ])('%s: pause %i ms, max COUNT %i', (tier, pauseMs, maxCount) => {
        expect(scanBudget(tier)).toEqual({ pauseMs, maxCount });
    });

    test('missing or unknown Tier gets the local budget', () => {
        expect(scanBudget(undefined)).toEqual({ pauseMs: 0, maxCount: 20000 });
        expect(scanBudget('qa')).toEqual({ pauseMs: 0, maxCount: 20000 });
    });
});
