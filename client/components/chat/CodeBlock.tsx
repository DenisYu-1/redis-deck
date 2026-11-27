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
    // One line is replaced, so only a block of one command can take its place:
    // that command, without its comments.
    const [command, ...more] = allStatements(code);

    const showConsole = () => {
        if (pathname !== '/console') void navigate('/console');
    };

    const open = () => {
        showToast(`Added to ${append(code)}`, 'success');
        showConsole();
    };

    const replace = (target: LineChip, text: string) => {
        if (!replaceLine(target, text)) {
            showToast(
                `Line ${target.line} has changed; nothing was replaced`,
                'error'
            );
            return;
        }
        showToast(`Replaced line ${target.line}`, 'success');
        showConsole();
    };

    return (
        <>
            {line && tab && command && more.length === 0 && (
                <Button size="xs" onClick={() => replace(line, command.text)}>
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
    const copy = async () => {
        try {
            // Plain-HTTP hosts have no clipboard API: this throws there.
            await navigator.clipboard.writeText(code);
            showToast('Copied', 'success');
        } catch {
            showToast('Could not copy', 'error');
        }
    };
    return (
        <div className="chat-code">
            <pre>{code}</pre>
            <div className="chat-codebar">
                <Button size="xs" onClick={() => void copy()}>
                    Copy
                </Button>
                <ConsoleActions code={code} line={line} />
            </div>
        </div>
    );
}
