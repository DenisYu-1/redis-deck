import { useState } from 'react';
import { showToast } from '@/utils/toast';
import { formatSize } from '@/utils/bytes';
import { decodeValue, type DecodeMode } from './decoders';

const MODES: [DecodeMode, string][] = [
    ['auto', 'Auto'],
    ['raw', 'Raw'],
    ['json', 'JSON'],
    ['php', 'PHP']
];

const FORMAT_LABEL = { raw: 'Raw', json: 'JSON', php: 'PHP' } as const;

interface Props {
    label: string;
    value: string;
    onClose?: () => void;
}

export function ValueInspector({ label, value, onClose }: Props) {
    const [mode, setMode] = useState<DecodeMode>('auto');
    const decoded = decodeValue(value, mode);
    const detected = decodeValue(value, 'auto').format;

    const copy = () => {
        navigator.clipboard.writeText(value).then(
            () => showToast('Copied value', 'success'),
            () => showToast('Copy failed', 'error')
        );
    };

    return (
        <section className="inspector" aria-label="Value inspector">
            <div className="ihead">
                <span className="mono sm">{label}</span>
                <span className="sm mu">
                    {formatSize(new TextEncoder().encode(value).length)}
                </span>
                <span style={{ flex: 1 }} />
                <div className="segs" role="group" aria-label="Decode as">
                    {MODES.map(([m, name]) => (
                        <button
                            key={m}
                            type="button"
                            aria-pressed={mode === m}
                            onClick={() => setMode(m)}
                        >
                            {m === 'auto'
                                ? `Auto · ${FORMAT_LABEL[detected]}`
                                : name}
                        </button>
                    ))}
                </div>
                <button type="button" className="btn xs" onClick={copy}>
                    Copy
                </button>
                {onClose && (
                    <button
                        type="button"
                        className="btn xs"
                        aria-label="Close"
                        onClick={onClose}
                    >
                        ×
                    </button>
                )}
            </div>
            <div className="ibody">
                {!decoded.ok && (
                    <div className="dim">
                        {`Not valid ${FORMAT_LABEL[decoded.format]}. Showing raw.`}
                    </div>
                )}
                <pre>{decoded.text}</pre>
            </div>
        </section>
    );
}
