import { useCallback, useEffect, useRef, useState } from 'react';
import {
    cancelJob,
    getJob,
    listJobs,
    startDeleteJob
} from '@/services/apiService';
import type { Job } from '@/types';

const POLL_MS = 500;

/**
 * The Connection's bulk delete job (mount with key={env}): picks up a running one on mount (the job
 * lives on the server), polls while it runs, and calls onFinished once.
 */
export function useDeleteJob(env: string, onFinished: () => void) {
    const [job, setJob] = useState<Job | null>(null);
    const finished = useRef(onFinished);
    useEffect(() => {
        finished.current = onFinished;
    });

    // A job that stops changes the Keys, so the list refreshes.
    const update = useCallback((next: Job) => {
        setJob(next);
        if (next.state !== 'running') finished.current();
    }, []);

    useEffect(() => {
        const ac = new AbortController();
        void (async () => {
            try {
                const running = (await listJobs(env, 'delete')).find(
                    (j) => j.state === 'running'
                );
                if (!ac.signal.aborted && running) setJob(running);
            } catch {
                // nothing to resume
            }
        })();
        return () => ac.abort();
    }, [env]);

    const id = job?.id;
    const running = job?.state === 'running';
    useEffect(() => {
        if (!id || !running) return;
        const ac = new AbortController();
        const timer = setInterval(() => {
            void getJob(id)
                .then((next) => {
                    if (!ac.signal.aborted) update(next);
                })
                .catch(() => undefined);
        }, POLL_MS);
        return () => {
            ac.abort();
            clearInterval(timer);
        };
    }, [id, running, update]);

    const start = useCallback(
        async (pattern: string, type: string) => {
            setJob(
                await startDeleteJob(
                    type ? { pattern, type } : { pattern },
                    env
                )
            );
        },
        [env]
    );

    const cancel = useCallback(async () => {
        if (id) update(await cancelJob(id));
    }, [id, update]);

    return { job, start, cancel, dismiss: () => setJob(null) };
}
