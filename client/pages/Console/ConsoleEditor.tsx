import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type RefObject,
    type TextareaHTMLAttributes
} from 'react';
import {
    getConsoleCommands,
    type ConsoleCommands
} from '@/services/apiService';
import type { RedisConnection } from '@/types';
import { checkLines } from './lineCheck';
import './consoleEditor.css';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
    value: string;
    editorRef: RefObject<HTMLTextAreaElement>;
    connection: RedisConnection | undefined;
};

/** The script editor with a gutter of line numbers and line-check marks. */
export function ConsoleEditor({
    value,
    editorRef,
    connection,
    ...textarea
}: Props) {
    const [list, setList] = useState<ConsoleCommands | null>(null);
    const lines = useRef<HTMLDivElement>(null);
    const marks = list ? checkLines(value, list, connection) : null;

    useEffect(() => {
        // without the list there are no marks; a run still checks
        getConsoleCommands().then(setList, () => undefined);
    }, []);

    const follow = (scrollTop: number) => {
        if (lines.current) {
            lines.current.style.transform = `translateY(${-scrollTop}px)`;
        }
    };

    // another tab's text can move the textarea without a scroll event
    useLayoutEffect(() => {
        follow(editorRef.current?.scrollTop ?? 0);
    }, [value, editorRef]);

    return (
        <div className="cedwrap">
            <div className="cgut">
                <div className="cgutin" ref={lines}>
                    {value.split('\n').map((_, i) => {
                        const mark = marks?.get(i + 1);
                        return (
                            <div className="cgl" key={i}>
                                <span aria-hidden="true">{i + 1}</span>
                                {mark && (
                                    <span
                                        className={`cmark ${mark.kind}`}
                                        data-mark={mark.kind}
                                        role="img"
                                        aria-label={`Line ${i + 1}: ${mark.message}`}
                                        title={mark.message}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            <textarea
                {...textarea}
                ref={editorRef}
                className="ced"
                value={value}
                onScroll={(e) => follow(e.currentTarget.scrollTop)}
            />
        </div>
    );
}
