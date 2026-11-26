export interface Statement {
    /** 1-based line number in the editor */
    line: number;
    text: string;
}

const COMMENT = /^(#|--|\/\/)/;

const lineOf = (script: string, offset: number) =>
    script.slice(0, offset).split('\n').length;

/** Every statement in the script; empty and comment lines are not statements. */
export function allStatements(script: string): Statement[] {
    return script
        .split('\n')
        .map((text, i) => ({ line: i + 1, text: text.trim() }))
        .filter((s) => s.text !== '' && !COMMENT.test(s.text));
}

/** The line to preselect: the cursor's, else the closest above, else the first. */
export function lineAtCursor(script: string, cursor: number) {
    const statements = allStatements(script);
    const line = lineOf(script, cursor);
    const above = statements.filter((s) => s.line <= line).pop();
    return (above ?? statements[0])?.line;
}

/**
 * The statements on the line under the cursor, or on every line the selection
 * touches.
 */
export function selectedStatements(
    script: string,
    start: number,
    end: number
): Statement[] {
    const first = lineOf(script, start);
    // a selection ending just after a newline does not include the next line
    const last = lineOf(script, end > start ? end - 1 : end);
    return allStatements(script).filter(
        (s) => s.line >= first && s.line <= last
    );
}
