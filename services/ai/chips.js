// The context chips of a chat message (client/utils/chatChips.ts), turned into
// the text the model reads. A Key chip names the Key only: its value is read
// through get_key, so AI access and hidden fields apply.
const isText = (v) => typeof v === 'string' && v !== '';

// Per kind: whether the chip is complete, and its text. Only the fields named
// here reach the model.
const KINDS = new Map([
    [
        'key',
        {
            valid: (c) => isText(c.connectionId) && isText(c.key),
            // Quoted: a Key name is Redis data and may hold anything.
            text: (c) =>
                `[Attached Key ${JSON.stringify(c.key)} on Connection ${JSON.stringify(c.connectionId)}. Only the name is attached: read it with get_key.]`
        }
    ]
]);

const isChips = (chips) =>
    chips === undefined ||
    (Array.isArray(chips) &&
        chips.every((c) => KINDS.get(c?.kind)?.valid(c) === true));

const withChips = (text, chips = []) =>
    [text, ...chips.map((c) => KINDS.get(c.kind).text(c))].join('\n\n');

module.exports = { isChips, withChips };
