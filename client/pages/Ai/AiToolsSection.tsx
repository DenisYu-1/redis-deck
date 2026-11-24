import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import {
    listAiTools,
    setAiToolEnabled,
    type AiTool
} from '@/services/apiService';

/** Tools exposed card: one global on/off switch per registered MCP tool. */
export function AiToolsSection() {
    const [tools, setTools] = useState<AiTool[]>([]);
    const { showToast } = useToast();

    useEffect(() => {
        let cancelled = false;
        listAiTools().then(
            (list) => {
                if (!cancelled) setTools(list);
            },
            (error: Error) => showToast(`AI tools: ${error.message}`, 'error')
        );
        return () => {
            cancelled = true;
        };
    }, [showToast]);

    const toggle = async (tool: AiTool, enabled: boolean) => {
        try {
            setTools(await setAiToolEnabled(tool.name, enabled));
        } catch (error) {
            showToast((error as Error).message, 'error');
        }
    };

    return (
        <section className="card sect" aria-label="Tools exposed">
            <h2>Tools exposed</h2>
            <p className="sm tx2">
                A tool that is turned off is hidden from AI clients and refused
                if called. Connection guards still apply to the tools that are
                on.
            </p>
            {tools.map((tool) => (
                <label key={tool.name} className="sw-row">
                    <input
                        type="checkbox"
                        aria-label={tool.name}
                        checked={tool.enabled}
                        onChange={(e) => void toggle(tool, e.target.checked)}
                    />
                    <span className="track">
                        <i />
                    </span>
                    <span className="ai-tool-main">
                        <code className="mono">{tool.name}</code>
                        {tool.write && (
                            <span className="badge auto ai-write">write</span>
                        )}
                        <span className="sm tx2 ai-tool-desc">
                            {tool.description}
                        </span>
                    </span>
                </label>
            ))}
        </section>
    );
}
