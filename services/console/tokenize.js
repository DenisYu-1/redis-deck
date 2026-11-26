// The Console's reading of a line, as in the design: "..." with backslash
// escapes, '...', else everything up to a space. A quote that is not closed, or
// that starts inside a word, is an ordinary character. The page has the same
// rules (client/pages/Console/lineCheck.ts).
const WORD = /"((?:\\.|[^"\\])*)"|'([^']*)'|(\S+)/g;

const tokenize = (text) =>
    Array.from(
        text.matchAll(WORD),
        ([, double, single, bare]) =>
            double?.replace(/\\(.)/g, '$1') ?? single ?? bare
    );

module.exports = { tokenize };
