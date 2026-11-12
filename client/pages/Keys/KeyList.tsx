import { List, type RowComponentProps } from 'react-window';
import { Badge, type RedisType } from '@/components/ui/Badge';
import type { KeyMeta } from '@/types';
import type { TreeRow } from '@/utils/keyTree';
import { highlightRange } from '@/utils/glob';
import { formatTtl, isTtlWarn } from '@/utils/ttl';
import { formatSize } from '@/utils/bytes';

export const ROW_HEIGHT = 30;

function Highlighted({ pattern, text }: { pattern: string; text: string }) {
    const range = highlightRange(pattern, text);
    if (!range) return <>{text}</>;
    return (
        <>
            {text.slice(0, range[0])}
            <mark>{text.slice(range[0], range[1])}</mark>
            {text.slice(range[1])}
        </>
    );
}

interface RowProps {
    rows: TreeRow[];
    meta: Record<string, KeyMeta>;
    pattern: string;
    activeKey: string | null;
    isSelected: (key: string) => boolean;
    onToggleSelect: (key: string) => void;
    onPick: (key: string) => void;
    onToggleFolder: (path: string) => void;
}

function Row({
    index,
    style,
    rows,
    meta,
    pattern,
    activeKey,
    isSelected,
    onToggleSelect,
    onPick,
    onToggleFolder
}: RowComponentProps<RowProps>) {
    const row = rows[index];
    if (!row) return null;

    if (row.kind === 'folder') {
        return (
            <div style={style} role="treeitem" aria-expanded={!!row.expanded}>
                <button
                    type="button"
                    className={`frow ${row.expanded ? 'open' : ''}`}
                    style={{ paddingLeft: 16 + row.depth * 14 }}
                    onClick={() => onToggleFolder(row.path)}
                >
                    <span className="chev" aria-hidden="true">
                        ›
                    </span>
                    <span className="nm">{row.name}:</span>
                    <span
                        className="kv"
                        title="Keys loaded so far under this folder, not the keyspace total"
                    >
                        {row.count} loaded
                    </span>
                </button>
            </div>
        );
    }

    const m = meta[row.key];
    const on = activeKey === row.key;
    return (
        <div
            style={{ ...style, paddingLeft: 16 + row.depth * 14 }}
            className={`krow ${on ? 'on' : ''}`}
            role="treeitem"
            onClick={() => onPick(row.key)}
        >
            <input
                type="checkbox"
                className="check"
                checked={isSelected(row.key)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onToggleSelect(row.key)}
                aria-label={`Select ${row.key}`}
            />
            <button
                type="button"
                className="kname"
                style={{ paddingLeft: 4 }}
                title={row.key}
                onClick={(e) => {
                    e.stopPropagation();
                    onPick(row.key);
                }}
            >
                <span className="leaf">
                    <Highlighted pattern={pattern} text={row.name} />
                </span>
            </button>
            <span className="c-type">
                {m && <Badge type={m.type as RedisType} />}
            </span>
            <span
                className={`kv c-ttl ${m && isTtlWarn(m.ttl) ? 'warnc' : ''}`}
            >
                {m ? formatTtl(m.ttl) : ''}
            </span>
            <span className="kv c-size">{m ? formatSize(m.size) : ''}</span>
        </div>
    );
}

/** Virtualized rows: only the visible window is in the DOM. */
export function KeyList(props: RowProps) {
    return (
        <div className="rows">
            <List
                className="rows-list"
                rowComponent={Row}
                rowCount={props.rows.length}
                rowHeight={ROW_HEIGHT}
                rowProps={props}
                role="tree"
                aria-label="Keys"
                style={{ height: '100%' }}
            />
        </div>
    );
}
