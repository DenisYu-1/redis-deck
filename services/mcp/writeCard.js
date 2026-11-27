// What a write call would do, in words, from its tool's card (tools/write.js):
// for the approval prompt and the assistant's approval cards.
const quote = (arg) => {
    const text = String(arg);
    return /^[^\s"'\\]+$/.test(text) ? text : JSON.stringify(text);
};
const commandLine = (argv) => argv.map(quote).join(' ');

// -> { title, commands: [one line each] }. Never throws: arguments the tool
// would reject itself are shown as they came.
function describeWrite(tool, args) {
    try {
        return {
            title: tool.card.title(args),
            commands: tool.card.commands(args).map(commandLine)
        };
    } catch {
        return {
            title: tool.name,
            commands: [`${tool.name} ${JSON.stringify(args)}`]
        };
    }
}

module.exports = { describeWrite };
