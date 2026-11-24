import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/useToast';
import {
    getAiActivityLogging,
    setAiActivityLogging
} from '@/services/apiService';

/** "Log AI operations" checkbox and the View activity button (AI clients panel). */
export function AiActivityControls() {
    const [logEnabled, setLogEnabled] = useState<boolean | null>(null);
    const { showToast } = useToast();

    useEffect(() => {
        let cancelled = false;
        getAiActivityLogging().then(
            (on) => {
                if (!cancelled) setLogEnabled(on);
            },
            (error: Error) =>
                showToast(`AI activity: ${error.message}`, 'error')
        );
        return () => {
            cancelled = true;
        };
    }, [showToast]);

    const toggle = async (on: boolean) => {
        try {
            setLogEnabled(await setAiActivityLogging(on));
        } catch (error) {
            showToast((error as Error).message, 'error');
        }
    };

    return (
        <div className="aic-log">
            <label className="aic-log-toggle">
                <input
                    type="checkbox"
                    checked={logEnabled ?? true}
                    disabled={logEnabled === null}
                    onChange={(e) => void toggle(e.target.checked)}
                />
                Log AI operations
            </label>
            <Link className="btn sm" to="/ai-activity">
                View activity
            </Link>
        </div>
    );
}
