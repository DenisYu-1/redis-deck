import { Button } from '@/components/ui/Button';
import { showToast } from '@/utils/toast';

/** A code block of an answer, with its actions. */
export function CodeBlock({ code }: { code: string }) {
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
            </div>
        </div>
    );
}
