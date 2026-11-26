// A scripted model adapter for turn runner tests. Each step() plays the next
// entry of the script (an array, or index -> entry):
// { text: [chunks], toolCalls: [{ name, args }], notice, error }.
function fakeModel(script) {
    const seen = { start: null, results: [], steps: 0 };
    let calls = 0;
    const adapter = {
        label: 'Fake',
        start(request) {
            seen.start = request;
            return {
                async step({ onText }) {
                    const index = seen.steps++;
                    const entry =
                        typeof script === 'function'
                            ? script(index)
                            : script[index];
                    for (const chunk of entry?.text ?? []) onText(chunk);
                    if (entry?.error) throw entry.error;
                    return {
                        notice: entry?.notice,
                        toolCalls: (entry?.toolCalls ?? []).map((call) => ({
                            id: `use-${++calls}`,
                            args: {},
                            ...call
                        }))
                    };
                },
                addToolResults(results) {
                    seen.results.push(results);
                }
            };
        }
    };
    return { adapter, seen };
}

module.exports = { fakeModel };
