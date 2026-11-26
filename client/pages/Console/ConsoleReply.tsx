import type { ConsoleResult } from '@/services/apiService';
import { formatNumber } from '@/utils/formatter';
import { showToast } from '@/utils/toast';
import { decodeValue, detectFormat } from '../Keys/decoders';
import { ValueInspector } from '../Keys/ValueInspector';
import { KeyLink } from './KeyLink';
import {
    returnsKeys,
    scanFrom,
    tableJson,
    tableOf,
    type TableShape
} from './shape';

/** A table cell: nested replies (SLOWLOG GET) are shown as JSON. */
function cell(value: unknown): string {
    if (value === null) return '(nil)';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

const MAX_ROWS = 500;

/** A table cell's value, decoded as the Keys page decodes it. */
function Cell({ value }: { value: unknown }) {
    const text = cell(value);
    const decoded = typeof value === 'string' && decodeValue(value, 'auto');
    if (!decoded || decoded.format === 'raw') return text;
    return (
        <>
            <span className="fmt">{decoded.format}</span>
            <pre className="rdec">{decoded.text}</pre>
        </>
    );
}

function copyRows(table: TableShape) {
    const count = countOf(table.rows.length);
    navigator.clipboard.writeText(tableJson(table)).then(
        () => showToast(`Copied ${count}`, 'success'),
        () => showToast('Copy failed', 'error')
    );
}

const countOf = (n: number) => `${formatNumber(n)} row${n === 1 ? '' : 's'}`;

type TableProps = TableShape & { onContinue: (cursor: string) => void };

function ReplyTable({ onContinue, ...table }: TableProps) {
    const { columns, rows, keys, cursor } = table;
    return (
        <>
            {rows.length === 0 ? (
                <div className="scalar mu">(empty array)</div>
            ) : (
                <table className="rgrid">
                    <thead>
                        <tr>
                            <th scope="col" className="rn">
                                #
                            </th>
                            {columns.map((column) => (
                                <th key={column} scope="col">
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.slice(0, MAX_ROWS).map((row, i) => (
                            <tr key={i}>
                                <td className="rn">{i + 1}</td>
                                {row.map((value, c) => (
                                    <td key={c}>
                                        {keys ? (
                                            <KeyLink name={String(value)} />
                                        ) : (
                                            <Cell value={value} />
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            <div className="rfoot xs mu">
                <span>
                    {countOf(rows.length)}
                    {rows.length > MAX_ROWS && ` · showing ${MAX_ROWS}`}
                </span>
                {cursor === '0' && <span>cursor 0 · iteration complete</span>}
                {cursor !== undefined && cursor !== '0' && (
                    <button
                        type="button"
                        className="btn xs"
                        onClick={() => onContinue(cursor)}
                    >
                        Continue from cursor {cursor}
                    </button>
                )}
                <button
                    type="button"
                    className="btn xs rcopy"
                    onClick={() => copyRows(table)}
                >
                    Copy JSON
                </button>
            </div>
        </>
    );
}

interface Props {
    result: ConsoleResult;
    /** Runs `text` in place of this result. */
    onRerun: (text: string) => void;
}

/** One statement's reply, rendered by its shape. */
export function ConsoleReply({ result, onRerun }: Props) {
    const { kind, reply } = result;
    if (kind === 'error') {
        return (
            <div className="rerr" role="alert">
                {String(reply)}
            </div>
        );
    }
    if (kind === 'not-run') {
        return <div className="scalar mu">Not run</div>;
    }
    const table = tableOf(result);
    if (table) {
        return (
            <ReplyTable
                {...table}
                onContinue={(cursor) => onRerun(scanFrom(result.text, cursor))}
            />
        );
    }
    if (typeof reply === 'string' && returnsKeys(result.text)) {
        return (
            <div className="scalar">
                <KeyLink name={reply} />
            </div>
        );
    }
    if (
        kind === 'bulk' &&
        typeof reply === 'string' &&
        detectFormat(reply) !== 'raw'
    ) {
        return <ValueInspector label="value" value={reply} />;
    }
    const text = kind === 'integer' ? `(integer) ${cell(reply)}` : cell(reply);
    return <div className="scalar">{text}</div>;
}
