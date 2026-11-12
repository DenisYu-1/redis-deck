import { useMemo, useState } from 'react';
import { Badge, type RedisType } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import type { KeyDetails, KeyInfo } from '@/types';
import { formatNumber } from '@/utils/formatter';
import { formatSize } from '@/utils/bytes';
import { formatTtl } from '@/utils/ttl';
import { showToast } from '@/utils/toast';
import { KeyActions } from './KeyActions';
import { ValueInspector } from './ValueInspector';
import { ValueTable } from './ValueTable';
import { filterRows, toRows } from './valueRows';

const LENGTH_LABEL: Record<string, string> = {
    string: 'Length',
    hash: 'Fields',
    list: 'Items',
    set: 'Members',
    zset: 'Members',
    stream: 'Entries'
};

const TABLE_TYPES = ['hash', 'list', 'set', 'zset'];

const dash = (v: string | null | undefined) => v ?? '–';

interface Props {
    keyName: string;
    details: KeyDetails | null;
    info: KeyInfo | null;
    loading: boolean;
    error: string | null;
    onReload: () => void;
    /** After a write: undefined = refresh, string = select that key, null = key gone. */
    onChanged: (next?: string | null) => void;
}

function KeyName({ name }: { name: string }) {
    const cut = name.lastIndexOf(':');
    return (
        <h2 title={name}>
            <span className="mu">{cut >= 0 ? name.slice(0, cut + 1) : ''}</span>
            {cut >= 0 ? name.slice(cut + 1) : name}
        </h2>
    );
}

function Body({ details }: { details: KeyDetails }) {
    const { type, value } = details;
    const [filter, setFilter] = useState('');
    const [picked, setPicked] = useState<string | null>(null);

    const rows = useMemo(() => toRows(type, value), [type, value]);
    const shown = useMemo(() => filterRows(rows, filter), [rows, filter]);

    if (type === 'string') {
        return <ValueInspector label="value" value={String(value ?? '')} />;
    }
    if (!TABLE_TYPES.includes(type)) {
        return (
            <ValueInspector
                label={`${type} (read-only)`}
                value={
                    value === null || value === undefined
                        ? `Reading ${type} values is not supported.`
                        : JSON.stringify(value, null, 2)
                }
            />
        );
    }
    const active = rows.find((r) => r.id === picked);
    return (
        <>
            <div className="dtools">
                <input
                    className="input"
                    style={{ flex: '1 1 180px', height: 30 }}
                    type="search"
                    placeholder={
                        type === 'hash' ? 'Filter fields…' : 'Filter items…'
                    }
                    aria-label="Filter"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
                <span className="sm mu">
                    {shown.length === rows.length
                        ? `${formatNumber(rows.length)} shown`
                        : `${formatNumber(shown.length)} of ${formatNumber(rows.length)}`}
                </span>
            </div>
            <div className="scroll">
                {shown.length === 0 ? (
                    <EmptyState title="Nothing to show">
                        {rows.length === 0
                            ? 'This key is empty.'
                            : 'No entries match the filter.'}
                    </EmptyState>
                ) : (
                    <ValueTable
                        type={type}
                        rows={shown}
                        activeId={picked}
                        onPick={(id) =>
                            setPicked((p) => (p === id ? null : id))
                        }
                        detail={
                            active && (
                                <ValueInspector
                                    label={active.label ?? active.value}
                                    value={active.value}
                                    onClose={() => setPicked(null)}
                                />
                            )
                        }
                    />
                )}
            </div>
        </>
    );
}

export function KeyDetail({
    keyName,
    details,
    info,
    loading,
    error,
    onReload,
    onChanged
}: Props) {
    if (error) {
        return (
            <EmptyState
                title={keyName}
                action={
                    <button type="button" className="btn sm" onClick={onReload}>
                        Retry
                    </button>
                }
            >
                {error}
            </EmptyState>
        );
    }
    if (!details) {
        return <EmptyState title={keyName}>Loading…</EmptyState>;
    }

    const copyName = () => {
        navigator.clipboard.writeText(keyName).then(
            () => showToast('Copied key name', 'success'),
            () => showToast('Copy failed', 'error')
        );
    };

    const memory = info?.memory ?? details.size ?? null;

    return (
        <div className="detail-body">
            <div className="dhead">
                <div className="dtitle">
                    <Badge type={details.type as RedisType} />
                    <KeyName name={keyName} />
                    <button
                        type="button"
                        className="btn xs"
                        onClick={copyName}
                        aria-label="Copy key name"
                    >
                        Copy name
                    </button>
                    <button
                        type="button"
                        className="btn xs"
                        onClick={onReload}
                        disabled={loading}
                        aria-label="Reload value"
                    >
                        {loading ? 'Loading…' : 'Reload'}
                    </button>
                </div>
                <KeyActions
                    keyName={keyName}
                    details={details}
                    onChanged={onChanged}
                />
                <dl className="meta">
                    <div>
                        <dt>TTL</dt>
                        <dd>{formatTtl(details.ttl)}</dd>
                    </div>
                    <div>
                        <dt>Memory</dt>
                        <dd>{formatSize(memory)}</dd>
                    </div>
                    <div>
                        <dt>Encoding</dt>
                        <dd>{dash(info?.encoding)}</dd>
                    </div>
                    <div>
                        <dt>{LENGTH_LABEL[details.type] ?? 'Length'}</dt>
                        <dd>
                            {info?.length == null
                                ? '–'
                                : formatNumber(info.length)}
                        </dd>
                    </div>
                    <div>
                        <dt>Idle</dt>
                        <dd>
                            {info?.idle == null
                                ? '–'
                                : formatTtl(info.idle) || '0s'}
                        </dd>
                    </div>
                </dl>
            </div>
            <Body key={keyName} details={details} />
        </div>
    );
}
