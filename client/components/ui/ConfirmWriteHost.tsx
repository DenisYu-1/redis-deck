import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { registerConfirmHost, type ConfirmRequest } from '@/utils/confirmWrite';

/** Modal that asks for the connection name before a Confirm-writes write. */
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
    const matches = typed === request.connectionId;
    const finish = (confirmed: boolean) => {
        request.resolve(confirmed);
        setRequest(null);
    };

    return (
        <Modal
            title="Confirm write"
            onClose={() => finish(false)}
            footer={
                <>
                    <Button onClick={() => finish(false)}>Cancel</Button>
                    <Button
                        variant="primary"
                        disabled={!matches}
                        onClick={() => finish(true)}
                    >
                        Confirm write
                    </Button>
                </>
            }
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (matches) finish(true);
                }}
            >
                <label className="field">
                    Type the connection name{' '}
                    <b className="mono">{request.connectionId}</b> to continue
                    <input
                        className="input mono"
                        autoFocus
                        autoComplete="off"
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                    />
                </label>
            </form>
        </Modal>
    );
}
