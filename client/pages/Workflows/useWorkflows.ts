import { useEffect, useState } from 'react';
import { getWorkflows } from '@/services/apiService';
import type { WorkflowPlugin } from '@/types/workflows';

/** Plugins that define Workflows (loaded once per mount). `null` while loading. */
export function useWorkflows(): WorkflowPlugin[] | null {
    const [plugins, setPlugins] = useState<WorkflowPlugin[] | null>(null);
    useEffect(() => {
        let cancelled = false;
        getWorkflows()
            .then((p) => !cancelled && setPlugins(p))
            .catch(() => !cancelled && setPlugins([]));
        return () => {
            cancelled = true;
        };
    }, []);
    return plugins;
}
