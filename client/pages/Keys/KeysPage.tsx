import { useCallback, useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Segmented } from '@/components/ui/Segmented';
import { useAppStore } from '@/store/useAppStore';
import type { TtlFilter } from '@/types';
import { buildKeyTree, flattenTree, type TreeRow } from '@/utils/keyTree';
import { formatNumber } from '@/utils/formatter';
import { KeyList } from './KeyList';
import { KeyToolbar } from './KeyToolbar';
import { useKeySelection } from './hooks/useKeySelection';
import { useKeysQuery } from './hooks/useKeysQuery';

type View = 'tree' | 'flat';

export function KeysPage() {
    const env = useAppStore((s) => s.currentEnvironment);
    const hasConnections = useAppStore((s) => s.connections.length > 0);
    const selectedKey = useAppStore((s) => s.selectedKey);
    const setSelectedKey = useAppStore((s) => s.setSelectedKey);

    const [pattern, setPattern] = useState('*');
    const [type, setType] = useState('');
    const [ttl, setTtl] = useState<TtlFilter>('any');
    const [view, setView] = useState<View>('tree');
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

    const query = useMemo(() => ({ pattern, type, ttl }), [pattern, type, ttl]);
    const data = useKeysQuery(env ?? null, query);
    const selection = useKeySelection(data.keys);

    const rows: TreeRow[] = useMemo(
        () =>
            view === 'tree'
                ? flattenTree(buildKeyTree(data.keys), expanded)
                : data.keys.map((key) => ({
                      kind: 'key' as const,
                      name: key,
                      key,
                      depth: 0
                  })),
        [view, data.keys, expanded]
    );

    const toggleFolder = useCallback((path: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (!next.delete(path)) next.add(path);
            return next;
        });
    }, []);

    if (!hasConnections) {
        return (
            <EmptyState title="No connections yet">
                Add a connection to browse keys.
            </EmptyState>
        );
    }

    const { scan } = data;
    const scanLine =
        data.loading && data.keys.length === 0
            ? 'Scanning…'
            : `${formatNumber(scan.matched)} matched · ${formatNumber(
                  scan.iterations
              )} SCAN calls · ${formatNumber(scan.ms)} ms${
                  data.hasMore ? ' · more to scan' : ''
              }`;

    return (
        <div className="keys-page">
            <KeyToolbar
                pattern={pattern}
                type={type}
                ttl={ttl}
                onPattern={setPattern}
                onType={setType}
                onTtl={setTtl}
                scanLine={scanLine}
            />
            <div className="panes">
                <section className="klist" aria-label="Keys">
                    <div className="khead">
                        <input
                            type="checkbox"
                            className="check"
                            aria-label="Select all loaded keys"
                            checked={selection.allSelected}
                            disabled={data.keys.length === 0}
                            onChange={selection.toggleAll}
                        />
                        <span className="khead-name">
                            Key
                            {selection.count > 0 &&
                                ` · ${String(selection.count)} selected`}
                        </span>
                        <span className="c-type">Type</span>
                        <span className="c-ttl">TTL</span>
                        <span className="c-size">Size</span>
                        <Segmented<View>
                            label="View mode"
                            value={view}
                            iconOnly
                            options={[
                                {
                                    value: 'tree',
                                    label: 'Tree view',
                                    icon: <span>▤</span>
                                },
                                {
                                    value: 'flat',
                                    label: 'Flat list',
                                    icon: <span>☰</span>
                                }
                            ]}
                            onChange={setView}
                        />
                    </div>
                    {data.error && (
                        <div className="banner" role="alert">
                            {data.error}
                            <button
                                type="button"
                                className="btn xs"
                                onClick={data.reload}
                            >
                                Retry
                            </button>
                        </div>
                    )}
                    {!data.error && !data.loading && data.keys.length === 0 ? (
                        <EmptyState title="No keys match">
                            Patterns use Redis glob syntax: *, ?, [abc]. Type
                            and TTL filters also apply.
                        </EmptyState>
                    ) : (
                        <KeyList
                            rows={rows}
                            meta={data.meta}
                            pattern={pattern}
                            activeKey={selectedKey}
                            isSelected={selection.has}
                            onToggleSelect={selection.toggle}
                            onPick={setSelectedKey}
                            onToggleFolder={toggleFolder}
                        />
                    )}
                    <div className="kfoot">
                        <span className="mono xs mu">
                            {formatNumber(data.keys.length)} loaded
                        </span>
                        {data.hasMore && (
                            <button
                                type="button"
                                className="btn sm"
                                disabled={data.loading}
                                onClick={data.loadMore}
                            >
                                {data.loading ? 'Loading…' : 'Load more'}
                            </button>
                        )}
                    </div>
                </section>
                <section className="detail" aria-label="Key detail">
                    <EmptyState title={selectedKey ?? 'Select a key'}>
                        {selectedKey
                            ? 'Key detail arrives with the next release.'
                            : 'Pick a key from the list to inspect it.'}
                    </EmptyState>
                </section>
            </div>
        </div>
    );
}
