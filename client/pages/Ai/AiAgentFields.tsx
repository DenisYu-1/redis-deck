import { InfoIcon } from '@/components/ui/Icons';
import type { AiModelDraft, AiModelSettings } from '@/services/apiService';
import { agentFields } from '@/utils/aiAgentFields';

interface Props {
    saved: AiModelSettings;
    draft: AiModelDraft;
    onChange: (change: Partial<AiModelDraft>) => void;
}

/** "Local agent" mode: which CLI, where it is and how it is started. */
export function AiAgentFields({ saved, draft, onChange }: Props) {
    const chosen = saved.agents.find((a) => a.id === draft.agent);

    return (
        <>
            <div className="agents" role="radiogroup" aria-label="Agent">
                {saved.agents.map((agent) => (
                    <label
                        key={agent.id}
                        className={`agent ${agent.id === draft.agent ? 'on' : ''}`}
                    >
                        <input
                            type="radio"
                            name="agent"
                            checked={agent.id === draft.agent}
                            onChange={() =>
                                onChange(agentFields(saved, agent.id))
                            }
                        />
                        <span className="agent-name">
                            <b>{agent.name}</b>
                            <span className="mono xs mu ellip">
                                {agent.found ??
                                    `${agent.command} not found on PATH`}
                            </span>
                        </span>
                        <span className={`pill ${agent.found ? 'ok' : 'off'}`}>
                            {agent.found ? 'found' : 'missing'}
                        </span>
                    </label>
                ))}
            </div>
            <div className="field">
                <label htmlFor="aim-path">Path</label>
                <input
                    id="aim-path"
                    className="input mono"
                    placeholder={`/full/path/to/${chosen?.command}`}
                    aria-describedby="aim-path-hint"
                    value={draft.agentPath}
                    onChange={(e) => onChange({ agentPath: e.target.value })}
                />
                <span id="aim-path-hint" className="hint">
                    Optional. Empty searches PATH and the usual install folders.
                </span>
            </div>
            <div className="field">
                <label htmlFor="aim-args">Arguments</label>
                <textarea
                    id="aim-args"
                    className="textarea mono aim-args"
                    rows={3}
                    spellCheck={false}
                    aria-describedby="aim-args-hint aim-args-warning"
                    value={draft.agentArgs}
                    onChange={(e) => onChange({ agentArgs: e.target.value })}
                />
                <span id="aim-args-hint" className="hint">
                    Redis Deck runs{' '}
                    <span className="mono">{chosen?.command}</span> with these
                    per chat turn.{' '}
                    <span className="mono">{'{mcp_config}'}</span> points the
                    agent at this server’s MCP endpoint. The agent uses its own
                    login. Empty restores the default.
                </span>
                <span id="aim-args-warning" className="hint aim-warning">
                    Changing the arguments can give the agent access to the
                    host: its files and commands.
                </span>
            </div>
            <p className="aim-note">
                <InfoIcon />
                <span>
                    Running in Docker? The CLI has to exist inside the Redis
                    Deck container (install or mount it), or use an API key
                    instead.
                </span>
            </p>
        </>
    );
}
