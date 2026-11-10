import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface BulkTtlDialogProps {
    count: number;
    /** seconds > 0, or null to remove the expiry */
    onSubmit: (seconds: number | null) => void;
    onClose: () => void;
}

export function BulkTtlDialog({
    count,
    onSubmit,
    onClose
}: BulkTtlDialogProps) {
    const [text, setText] = useState('');
    const [persist, setPersist] = useState(false);
    const seconds = Number(text);
    const valid = persist || (Number.isInteger(seconds) && seconds > 0);

    return (
        <Modal
            title={`Set TTL on ${String(count)} keys`}
            onClose={onClose}
            footer={
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button
                        variant="primary"
                        disabled={!valid}
                        onClick={() => onSubmit(persist ? null : seconds)}
                    >
                        Apply
                    </Button>
                </>
            }
        >
            <label className="field">
                TTL in seconds
                <input
                    className="input mono"
                    inputMode="numeric"
                    value={text}
                    disabled={persist}
                    onChange={(e) => setText(e.target.value)}
                />
            </label>
            <label className="sm">
                <input
                    type="checkbox"
                    checked={persist}
                    onChange={(e) => setPersist(e.target.checked)}
                />{' '}
                Remove expiry (PERSIST)
            </label>
        </Modal>
    );
}
