import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { allStatements } from '@/pages/Console/statements';
import { useConsoleTabs } from '@/pages/Console/useConsoleTabs';
import { useAppStore } from '@/store/useAppStore';
import type { LineChip } from '@/utils/chatChips';
import { showToast } from '@/utils/toast';

interface Props {
    code: string;
    /** The Console line the question was about, if any. */
    line?: LineChip | undefined;
}

/** Puts the code into the Console's editor. It never runs anything. */
function ConsoleActions({ code, line }: Props) {
    const { tabs } = useConsoleTabs();
    const append = useAppStore((s) => s.appendToConsole);
    const replaceLine = useAppStore((s) => s.replaceConsoleLine);
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const tab = tabs.find((t) => t.id === line?.tabId);
    // One line is replaced, so by the first command, not by a comment.
    const command = allStatements(code)[0]?.text;

    const showConsole = () => {
        if (pathname !== '/console') void navigate('/console');
    };

    const open = () => {
        showToast(`Added to ${append(code)}`, 'success');
        showConsole();
    };

    const replace = (target: LineChip, text: string) => {
        if (!replaceLine(target.tabId, target.line, text)) {
            showToast(`Line ${target.line} is no longer there`, 'error');
            return;
        }
        showToast(`Replaced line ${target.line}`, 'success');
        showConsole();
    };

    return (
        <>
            {line && tab && command !== undefined && (
                <Button size="xs" onClick={() => replace(line, command)}>
                    Replace line {line.line} in {tab.name}
                </Button>
            )}
            <Button size="xs" onClick={open}>
                Open in console
            </Button>
        </>
    );
}

/** A code block of an answer, with its actions. */
export function CodeBlock({ code, line }: Props) {
    const copy = () => {
        const failed = () => showToast('Could not copy', 'error');
        // Plain-HTTP hosts have no clipboard API.
        if (!('clipboard' in navigator)) return failed();
        navigator.clipboard
            .writeText(code)
            .then(() => showToast('Copied', 'success'), failed);
    };
    return (
        <div className="chat-code">
            <pre>{code}</pre>
            <div className="chat-codebar">
                <Button size="xs" onClick={copy}>
                    Copy
                </Button>
                <ConsoleActions code={code} line={line} />
            </div>
        </div>
    );
}
