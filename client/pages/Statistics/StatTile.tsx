import { Spark } from '@/components/ui/Spark';
import { formatBytes, formatNumber } from '@/utils/formatter';
import type { Tile } from './tiles';

function display(tile: Tile): { big: string; unit: string } {
    const v = tile.value;
    if (v === null) return { big: '—', unit: '' };
    switch (tile.id) {
        case 'mem': {
            const [num = '', ...unit] = formatBytes(v).split(' ');
            return { big: num, unit: unit.join(' ') };
        }
        case 'hit':
            return { big: v.toFixed(1), unit: '%' };
        case 'cpu':
            return { big: v.toFixed(1), unit: '%' };
        case 'ops':
            return { big: formatNumber(Math.round(v)), unit: 'ops/s' };
        default:
            return { big: formatNumber(Math.round(v)), unit: '' };
    }
}

export function StatTile({ tile }: { tile: Tile }) {
    const { big, unit } = display(tile);
    return (
        <article
            className={`tile ${tile.state !== 'ok' ? 'warn' : ''}`}
            data-testid={`tile-${tile.id}`}
            data-state={tile.state}
        >
            <h3>
                <span style={{ flex: 1 }}>{tile.title}</span>
                {tile.state === 'warn' && (
                    <span className="state w">Warning</span>
                )}
                {tile.state === 'crit' && (
                    <span className="state c">Critical</span>
                )}
            </h3>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span className="big">{big}</span>
                <span className="unit">{unit}</span>
            </div>
            <Spark
                values={tile.series}
                {...(tile.threshold ? { threshold: tile.threshold.warn } : {})}
            />
        </article>
    );
}
