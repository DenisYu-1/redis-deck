import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { parseMarkdown, type MarkdownBlock } from '@/utils/markdown';
import { CodeBlock } from './CodeBlock';

// `code`, **bold**, [label](url), *italic*
const INLINE =
    /`([^`]+)`|\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(?<![^\s(])\*(?!\s)([^*]+?)(?<!\s)\*(?![\w*])/g;

/**
 * Only links into this app become links: the text comes from a model that has
 * read Redis data, so an outside URL is shown, never offered for a click.
 */
const link = (label: string, url: string, key: number): ReactNode =>
    url.startsWith('/') && !url.startsWith('//') ? (
        <Link key={key} to={url}>
            {label}
        </Link>
    ) : (
        <Fragment key={key}>
            {label} ({url})
        </Fragment>
    );

function inline(text: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    let done = 0;
    for (const match of text.matchAll(INLINE)) {
        const [whole, code, bold, label, url, italic] = match;
        const key = match.index;
        nodes.push(text.slice(done, match.index));
        if (code !== undefined) nodes.push(<code key={key}>{code}</code>);
        else if (bold !== undefined)
            nodes.push(<strong key={key}>{inline(bold)}</strong>);
        else if (label !== undefined && url !== undefined)
            nodes.push(link(label, url, key));
        else nodes.push(<em key={key}>{inline(italic ?? '')}</em>);
        done = match.index + whole.length;
    }
    nodes.push(text.slice(done));
    return nodes;
}

function Block({ block }: { block: MarkdownBlock }) {
    if (block.kind === 'code') return <CodeBlock code={block.text} />;
    if (block.kind === 'heading') {
        return (
            <p>
                <strong>{inline(block.text)}</strong>
            </p>
        );
    }
    if (block.kind === 'p') {
        return (
            <p>
                {block.lines.map((line, i) => (
                    <Fragment key={i}>
                        {i > 0 && <br />}
                        {inline(line)}
                    </Fragment>
                ))}
            </p>
        );
    }
    const List = block.kind;
    return (
        <List>
            {block.items.map((item, i) => (
                <li key={i}>{inline(item)}</li>
            ))}
        </List>
    );
}

/** Renders as React elements only, so no HTML in the text is ever parsed. */
export function Markdown({ text }: { text: string }) {
    return (
        <>
            {parseMarkdown(text).map((block, i) => (
                <Block key={i} block={block} />
            ))}
        </>
    );
}
