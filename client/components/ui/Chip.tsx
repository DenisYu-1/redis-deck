import type { ButtonHTMLAttributes } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    on?: boolean;
    /** Redis type name; tints the chip with the `--t-<type>` colour. */
    tone?: string;
}

export function Chip({
    on = false,
    tone,
    className = '',
    style,
    ...rest
}: ChipProps) {
    return (
        <button
            type="button"
            aria-pressed={on}
            className={`chip ${on ? 'on' : ''} ${className}`.trim()}
            style={
                tone
                    ? { ['--tc' as string]: `var(--t-${tone})`, ...style }
                    : style
            }
            {...rest}
        />
    );
}
