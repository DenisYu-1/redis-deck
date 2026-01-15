import React from 'react';

export interface SvgIconProps extends React.SVGProps<SVGSVGElement> {
    component: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    inheritViewBox?: boolean;
}

export function SvgIcon({
    component: Component,
    inheritViewBox,
    className,
    ...props
}: SvgIconProps) {
    return (
        <Component
            className={className}
            {...(inheritViewBox ? {} : { viewBox: '0 0 24 24' })}
            {...props}
        />
    );
}
