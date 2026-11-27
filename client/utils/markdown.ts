// The Markdown the assistant writes, split into blocks: paragraphs, headings,
// lists and fenced code. Inline marks are the renderer's job.

export type MarkdownBlock =
    | { kind: 'code'; text: string }
    | { kind: 'ul' | 'ol'; items: string[] }
    | { kind: 'heading'; text: string }
    | { kind: 'p'; lines: string[] };

const FENCE = /^(\s*)```/;
const HEADING = /^#{1,6}\s+(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

export function parseMarkdown(source: string): MarkdownBlock[] {
    const blocks: MarkdownBlock[] = [];
    // A blank line ends the paragraph or list a next line would continue.
    let afterBlank = false;
    const lines = source.split('\n');

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] ?? '';
        const fence = FENCE.exec(line);
        const heading = HEADING.exec(line);
        const bullet = BULLET.exec(line);
        const item = bullet ?? NUMBERED.exec(line);
        const last = afterBlank ? undefined : blocks.at(-1);

        if (fence) {
            const indent = new RegExp(`^\\s{0,${fence[1]?.length ?? 0}}`);
            const code: string[] = [];
            // An unclosed fence (still streaming) runs to the end.
            for (i += 1; i < lines.length; i += 1) {
                const next = lines[i] ?? '';
                if (/^\s*```\s*$/.test(next)) break;
                code.push(next.replace(indent, ''));
            }
            blocks.push({ kind: 'code', text: code.join('\n') });
        } else if (heading) {
            blocks.push({ kind: 'heading', text: heading[1] ?? '' });
        } else if (item) {
            const kind = bullet ? 'ul' : 'ol';
            const text = item[1] ?? '';
            if (last?.kind === kind) last.items.push(text);
            else blocks.push({ kind, items: [text] });
        } else if (line.trim() !== '') {
            if (last?.kind === 'p') last.lines.push(line);
            else blocks.push({ kind: 'p', lines: [line] });
        }
        afterBlank = line.trim() === '';
    }
    return blocks;
}
