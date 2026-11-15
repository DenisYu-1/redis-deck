import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelJob, getJob, listJobs } from '@/services/apiService';
import type { Job } from '@/types';

const POLL_MS = 500;

/**
 * The Connection's server job of one kind (mount with key={env}): picks up a running one on mount
 * (the job lives on the server), polls while it runs, and calls onFinished once it stops.
 * start(target) creates the job through `create`.
 */
export function useJob<P, T>(
    env: string,
    kind: string,
    create: (target: T, env: string) => Promise<Job<P>>,
    onFinished: (job: Job<P>) => void = () => undefined
) {
    const [job, setJob] = useState<Job<P> | null>(null);
    const finished = useRef(onFinished);
    const creator = useRef(create);
    useEffect(() => {
        finished.current = onFinished;
        creator.current = create;
    });

    const update = useCallback((next: Job<P>) => {
        setJob(next);
        if (next.state !== 'running') finished.current(next);
    }, []);

    useEffect(() => {
        const ac = new AbortController();
        void (async () => {
            try {
                const running = (await listJobs<P>(env, kind)).find(
                    (j) => j.state === 'running'
                );
                if (!ac.signal.aborted && running) setJob(running);
            } catch {
                // nothing to resume
            }
        })();
        return () => ac.abort();
    }, [env, kind]);

    const id = job?.id;
    const running = job?.state === 'running';
    useEffect(() => {
        if (!id || !running) return;
        const ac = new AbortController();
        const timer = setInterval(() => {
            void getJob<P>(id)
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
        async (target: T) => {
            setJob(await creator.current(target, env));
        },
        [env]
    );

    const cancel = useCallback(async () => {
        if (id) update(await cancelJob<P>(id));
    }, [id, update]);

    return { job, start, cancel, dismiss: () => setJob(null) };
}
