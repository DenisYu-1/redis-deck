import type { ReactNode } from 'react';

interface Option<T extends string> {
    value: T;
    label: string;
    icon?: ReactNode;
}

interface SegmentedProps<T extends string> {
    label: string;
    value: T;
    options: Option<T>[];
    onChange: (value: T) => void;
    /** Hide the text and keep it for screen readers only. */
    iconOnly?: boolean;
}

export function Segmented<T extends string>({
    label,
    value,
    options,
    onChange,
    iconOnly = false
}: SegmentedProps<T>) {
    return (
        <div className="seg" role="radiogroup" aria-label={label}>
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={o.value === value}
                    aria-label={o.label}
                    title={o.label}
                    onClick={() => onChange(o.value)}
                >
                    {o.icon}
                    {!iconOnly && <span>{o.label}</span>}
                </button>
            ))}
        </div>
    );
}
