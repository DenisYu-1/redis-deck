import { Button } from '@/components/ui/Button';
import { formatNumber } from '@/utils/formatter';

interface SelectionBarProps {
    count: number;
    matched: number;
    readOnly: boolean;
    onClear: () => void;
    onTtl: () => void;
    onExport: () => void;
    onDelete: () => void;
}

export function SelectionBar({
    count,
    matched,
    readOnly,
    onClear,
    onTtl,
    onExport,
    onDelete
}: SelectionBarProps) {
    if (count === 0) return null;
    return (
        <div className="selbar">
            <b>{`${formatNumber(count)} selected`}</b>
            <span className="sm mu">{`of ${formatNumber(matched)} matched`}</span>
            <Button size="xs" className="selbar-clear" onClick={onClear}>
                Clear
            </Button>
            <span className="selbar-gap" />
            <Button size="sm" disabled={readOnly} onClick={onTtl}>
                Set TTL
            </Button>
            <Button size="sm" onClick={onExport}>
                Export
            </Button>
            <Button
                size="sm"
                variant="danger"
                disabled={readOnly}
                onClick={onDelete}
            >
                Delete…
            </Button>
        </div>
    );
}
