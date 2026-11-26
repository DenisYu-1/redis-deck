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
    // The paragraph or list that the next line may continue.
    let open: MarkdownBlock | null = null;
    const start = <B extends MarkdownBlock>(block: B): B => {
        blocks.push(block);
        open = block;
        return block;
    };
    const lines = source.split('\n');

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] ?? '';
        const fence = FENCE.exec(line);
        const heading = HEADING.exec(line);
        const bullet = BULLET.exec(line);
        const item = bullet ?? NUMBERED.exec(line);
        const current = open as MarkdownBlock | null;

        if (fence) {
            const indent = new RegExp(`^\\s{0,${fence[1]?.length ?? 0}}`);
            const code: string[] = [];
            // An unclosed fence (still streaming) runs to the end.
            for (i += 1; i < lines.length; i += 1) {
                const next = lines[i] ?? '';
                if (/^\s*```\s*$/.test(next)) break;
                code.push(next.replace(indent, ''));
            }
            start({ kind: 'code', text: code.join('\n') });
            open = null;
        } else if (line.trim() === '') {
            open = null;
        } else if (heading) {
            start({ kind: 'heading', text: heading[1] ?? '' });
            open = null;
        } else if (item) {
            const kind = bullet ? 'ul' : 'ol';
            const list =
                current?.kind === kind
                    ? current
                    : start({ kind, items: [] as string[] });
            list.items.push(item[1] ?? '');
        } else {
            const paragraph =
                current?.kind === 'p'
                    ? current
                    : start({ kind: 'p' as const, lines: [] as string[] });
            paragraph.lines.push(line);
        }
    }
    return blocks;
}
