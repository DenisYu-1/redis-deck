export interface Statement {
    /** 1-based line number in the editor */
    line: number;
    text: string;
}

const COMMENT = /^(#|--|\/\/)/;

const lineOf = (script: string, offset: number) =>
    script.slice(0, offset).split('\n').length;

/**
 * The statements on the line under the cursor, or on every line the selection
 * touches. Empty lines and comment lines are not statements.
 */
export function selectedStatements(
    script: string,
    start: number,
    end: number
): Statement[] {
    const first = lineOf(script, start);
    // a selection ending just after a newline does not include the next line
    const last = lineOf(script, end > start ? end - 1 : end);
    return script
        .split('\n')
        .map((text, i) => ({ line: i + 1, text: text.trim() }))
        .filter(
            (s) =>
                s.line >= first &&
                s.line <= last &&
                s.text !== '' &&
                !COMMENT.test(s.text)
        );
}
