import { useCallback, useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Segmented } from '@/components/ui/Segmented';
import { useAppStore } from '@/store/useAppStore';
import type { TtlFilter } from '@/types';
import { buildKeyTree, flattenTree, type TreeRow } from '@/utils/keyTree';
import { formatNumber } from '@/utils/formatter';
import { BulkActions } from './BulkActions';
import { KeyDetail } from './KeyDetail';
import { KeyList } from './KeyList';
import { KeyToolbar } from './KeyToolbar';
import { NewKeyModal } from './NewKeyModal';
import { useKeySelection } from './hooks/useKeySelection';
import { useKeyDetail } from './hooks/useKeyDetail';
import { useKeysQuery } from './hooks/useKeysQuery';

type View = 'tree' | 'flat';

export function KeysPage() {
    const env = useAppStore((s) => s.currentEnvironment);
    const selectedKey = useAppStore((s) => s.selectedKey);
    const setSelectedKey = useAppStore((s) => s.setSelectedKey);

    const readOnly = useAppStore(
        (s) => s.connections.find((c) => c.id === env)?.readOnly === true
    );

    const pattern = useAppStore((s) => s.keyPattern);
    // (pattern lives in the store so the sidebar can apply saved searches)
    const setPattern = useAppStore((s) => s.setKeyPattern);
    const [type, setType] = useState('');
    const [ttl, setTtl] = useState<TtlFilter>('any');
    const [creating, setCreating] = useState(false);
    const [view, setView] = useState<View>('tree');
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

    const query = useMemo(() => ({ pattern, type, ttl }), [pattern, type, ttl]);
    const data = useKeysQuery(env ?? null, query);
    const selection = useKeySelection(
        data.keys,
        `${env ?? ''}\u0000${pattern}\u0000${type}\u0000${ttl}`
    );
    const detail = useKeyDetail(env ?? null, selectedKey);

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

    // After a write: refresh the list and the detail; follow a rename, drop a delete.
    const { reload: reloadList } = data;
    const { reload: reloadDetail } = detail;
    const afterWrite = useCallback(
        (next?: string | null) => {
            reloadList();
            if (next === undefined) reloadDetail();
            else setSelectedKey(next);
        },
        [reloadList, reloadDetail, setSelectedKey]
    );

    const toggleFolder = useCallback((path: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (!next.delete(path)) next.add(path);
            return next;
        });
    }, []);

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
                onNewKey={() => setCreating(true)}
                newKeyDisabled={readOnly}
            />
            {creating && env && (
                <NewKeyModal
                    env={env}
                    onClose={() => setCreating(false)}
                    onCreated={(key) => afterWrite(key)}
                />
            )}
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
                    <BulkActions
                        env={env ?? ''}
                        readOnly={readOnly}
                        keys={selection.keys}
                        matched={data.keys.length}
                        onClear={selection.clear}
                        onChanged={data.reload}
                    />
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
                    {selectedKey ? (
                        <KeyDetail
                            keyName={selectedKey}
                            details={
                                detail.details?.key === selectedKey
                                    ? detail.details
                                    : null
                            }
                            info={detail.info}
                            loading={detail.loading}
                            error={detail.error}
                            onReload={detail.reload}
                            onChanged={afterWrite}
                        />
                    ) : (
                        <EmptyState title="Select a key">
                            Pick a key from the list to inspect it.
                        </EmptyState>
                    )}
                </section>
            </div>
        </div>
    );
}
