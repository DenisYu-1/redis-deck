/** What a caller adds to the plain "type the connection name" dialog. */
export interface ConfirmDetails {
    title: string;
    confirmLabel: string;
    /** The writes about to run, one per line */
    lines: string[];
    note?: string | undefined;
    /** False: a click confirms, without typing the connection name */
    typeName: boolean;
}

export interface ConfirmRequest {
    connectionId: string;
    details?: ConfirmDetails | undefined;
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

/** Asks the user to confirm a write; false when they decline. */
export function requestWriteConfirmation(
    connectionId: string,
    details?: ConfirmDetails
): Promise<boolean> {
    return new Promise((resolve) => {
        if (!host) {
            resolve(false);
            return;
        }
        host({ connectionId, details, resolve });
    });
}
