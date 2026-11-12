import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'primary' | 'danger';
    size?: 'md' | 'sm' | 'xs';
}

export function Button({
    variant = 'default',
    size = 'md',
    className = '',
    type = 'button',
    ...rest
}: ButtonProps) {
    const cls = [
        'btn',
        variant !== 'default' ? variant : '',
        size !== 'md' ? size : '',
        className
    ]
        .filter(Boolean)
        .join(' ');
    return <button type={type} className={cls} {...rest} />;
}
