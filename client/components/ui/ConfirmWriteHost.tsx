import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { registerConfirmHost, type ConfirmRequest } from '@/utils/confirmWrite';

/** Modal that asks to confirm before a Confirm-writes write. */
export function ConfirmWriteHost() {
    const [request, setRequest] = useState<ConfirmRequest | null>(null);
    const [typed, setTyped] = useState('');

    useEffect(
        () =>
            registerConfirmHost((r) => {
                setTyped('');
                setRequest(r);
            }),
        []
    );

    if (!request) return null;
    const { details } = request;
    const typeName = details?.typeName ?? true;
    const matches = !typeName || typed === request.connectionId;
    const finish = (confirmed: boolean) => {
        request.resolve(confirmed);
        setRequest(null);
    };

    return (
        <Modal
            title={details?.title ?? 'Confirm write'}
            onClose={() => finish(false)}
            footer={
                <>
                    <Button onClick={() => finish(false)}>Cancel</Button>
                    <Button
                        variant={details && typeName ? 'danger' : 'primary'}
                        autoFocus={!typeName}
                        disabled={!matches}
                        onClick={() => finish(true)}
                    >
                        {details?.confirmLabel ?? 'Confirm write'}
                    </Button>
                </>
            }
        >
            {details && (
                <>
                    <pre className="codeline">{details.lines.join('\n')}</pre>
                    {details.note && (
                        <span className="sm mu">{details.note}</span>
                    )}
                </>
            )}
            {typeName && (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (matches) finish(true);
                    }}
                >
                    <label className="field">
                        Type the connection name{' '}
                        <b className="mono">{request.connectionId}</b> to
                        continue
                        <input
                            className="input mono"
                            autoFocus
                            autoComplete="off"
                            value={typed}
                            onChange={(e) => setTyped(e.target.value)}
                        />
                    </label>
                </form>
            )}
        </Modal>
    );
}
