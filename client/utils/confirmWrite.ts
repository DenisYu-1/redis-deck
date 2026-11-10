export interface ConfirmRequest {
    connectionId: string;
    resolve: (confirmed: boolean) => void;
}

type Host = (request: ConfirmRequest) => void;

let host: Host | null = null;

/** The mounted ConfirmWriteHost registers itself here. */
export function registerConfirmHost(next: Host): () => void {
    host = next;
    return () => {
        if (host === next) host = null;
    };
}

/** Asks the user to type the connection name; false when they decline. */
export function requestWriteConfirmation(
    connectionId: string
): Promise<boolean> {
    return new Promise((resolve) => {
        if (!host) {
            resolve(false);
            return;
        }
        host({ connectionId, resolve });
    });
}
