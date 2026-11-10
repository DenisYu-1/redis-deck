import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { boardById, loadRemoved, saveRemoved, WIDGET_TITLES } from './boards';
import { renderWidget } from './widgets';
import { useStatsData } from './useStatsData';
import { useAppStore } from '@/store/useAppStore';
import './statistics.css';

const RANGES = [
    { label: '1h', hours: 1 },
    { label: '6h', hours: 6 },
    { label: '24h', hours: 24 },
    { label: '7d', hours: 168 },
    { label: '30d', hours: 720 }
];

export function StatisticsApp() {
    const { currentEnvironment } = useAppStore();
    const [hours, setHours] = useState(24);
    const [live, setLive] = useState(true);
    const [editing, setEditing] = useState(false);
    const board = boardById(useParams().board);
    const env = currentEnvironment ?? '';
    const layoutKey = `${env}:${board.id}`;
    const [stored, setStored] = useState<{ key: string; ids: string[] }>({
        key: layoutKey,
        ids: loadRemoved(env, board.id)
    });
    const removed =
        stored.key === layoutKey ? stored.ids : loadRemoved(env, board.id);
    const updateRemoved = (ids: string[]) => {
        saveRemoved(env, board.id, ids);
        setStored({ key: layoutKey, ids });
    };
    const visible = board.widgets.filter((w) => !removed.includes(w));
    const { history, tiles, loadingHistory } = useStatsData(
        currentEnvironment,
        hours,
        live
    );

    return (
        <div className="stats-page">
            <div className="viewhead">
                <div className="titles">
                    <h1>{board.title}</h1>
                    <span className="mono xs mu">
                        Snapshots every 5 min · 30-day retention
                        {currentEnvironment ? ` · ${currentEnvironment}` : ''}
                    </span>
                </div>
                <div className="segs" role="group" aria-label="Time range">
                    {RANGES.map((r) => (
                        <button
                            key={r.label}
                            type="button"
                            aria-pressed={r.hours === hours}
                            onClick={() => setHours(r.hours)}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
                {removed.length > 0 && (
                    <button
                        type="button"
                        className="btn"
                        onClick={() => updateRemoved([])}
                    >
                        Restore removed
                    </button>
                )}
                <button
                    type="button"
                    className="btn"
                    aria-pressed={editing}
                    onClick={() => setEditing((v) => !v)}
                >
                    {editing ? 'Done' : 'Edit layout'}
                </button>
                <button
                    type="button"
                    className={`btn live ${live ? '' : 'off'}`}
                    aria-pressed={live}
                    onClick={() => setLive((v) => !v)}
                >
                    <i />
                    {live ? 'Live' : 'Paused'}
                </button>
            </div>
            <div className="board">
                {visible.length === 0 && (
                    <div className="empty-board" data-testid="empty-board">
                        No widgets on this board. Use Restore removed to bring
                        them back.
                    </div>
                )}
                <div className="wgrid">
                    {visible.map((w) => (
                        <div
                            key={w}
                            className={`widget ${w === 'tiles' ? 'full' : ''} ${editing ? 'editing' : ''}`}
                            data-widget={w}
                        >
                            {editing && (
                                <button
                                    type="button"
                                    className="widget-remove"
                                    aria-label={`Remove ${WIDGET_TITLES[w]}`}
                                    onClick={() =>
                                        updateRemoved([...removed, w])
                                    }
                                >
                                    ×
                                </button>
                            )}
                            {renderWidget(w, {
                                history,
                                hours,
                                loading: loadingHistory,
                                tiles,
                                tileIds: board.tiles
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
