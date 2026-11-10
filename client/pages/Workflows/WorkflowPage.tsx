import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';
import {
    getWorkflowHistory,
    planWorkflow,
    runWorkflow
} from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import type { WorkflowAction, WorkflowRun } from '@/types/workflows';
import { initialValues, validateWorkflowInputs } from '@/utils/workflowInputs';
import { ActionForm } from './ActionForm';
import { PlanPanel, type Outcome } from './PlanPanel';
import { RunHistory } from './RunHistory';
import { useWorkflows } from './useWorkflows';

function ActionView({ action }: { action: WorkflowAction }) {
    const env = useAppStore((s) => s.currentEnvironment);
    const conn = useAppStore((s) =>
        s.connections.find((c) => c.id === s.currentEnvironment)
    );
    const [values, setValues] = useState(() => initialValues(action.inputs));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [outcome, setOutcome] = useState<Outcome | null>(null);
    const [runs, setRuns] = useState<WorkflowRun[]>([]);
    const [busy, setBusy] = useState(false);

    const loadHistory = useCallback(() => {
        getWorkflowHistory(action.fullId)
            .then(setRuns)
            .catch(() => undefined);
    }, [action.fullId]);
    useEffect(loadHistory, [loadHistory]);

    const blockedReason =
        action.writes && conn?.readOnly
            ? 'Blocked: this connection is read-only.'
            : !env
              ? 'Select a connection first.'
              : null;

    const exec = async (kind: 'plan' | 'run') => {
        if (!env) {
            return;
        }
        const found = validateWorkflowInputs(action.inputs, values);
        setErrors(found);
        if (Object.keys(found).length > 0) {
            return;
        }
        setBusy(true);
        try {
            if (kind === 'plan') {
                const p = await planWorkflow(action.fullId, env, values);
                setOutcome({ kind: 'plan', ok: true, text: p.text });
            } else {
                const r = await runWorkflow(
                    action.fullId,
                    env,
                    values,
                    action.writes
                );
                setOutcome({ kind: 'result', ok: r.ok, text: r.text });
                loadHistory();
            }
        } catch (error) {
            setOutcome({
                kind: 'error',
                ok: false,
                text: error instanceof Error ? error.message : String(error)
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="wf-page">
            <h1>{action.title}</h1>
            {action.desc && <p className="mu">{action.desc}</p>}
            <ActionForm
                action={action}
                values={values}
                errors={errors}
                busy={busy}
                blockedReason={blockedReason}
                onChange={(name, v) => setValues((s) => ({ ...s, [name]: v }))}
                onPlan={() => void exec('plan')}
                onRun={() => void exec('run')}
            />
            <PlanPanel outcome={outcome} />
            <RunHistory runs={runs} />
        </div>
    );
}

export function WorkflowPage() {
    const { actionId } = useParams();
    const plugins = useWorkflows();
    if (plugins === null) {
        return null;
    }
    const action = plugins
        .flatMap((p) => p.actions)
        .find((a) => a.fullId === actionId);
    if (!action) {
        return <EmptyState title="Workflow not found" />;
    }
    // key: reset form state when navigating between actions
    return <ActionView key={action.fullId} action={action} />;
}
