interface SparkProps {
    values: number[];
    /** Optional threshold drawn as a dashed line. */
    threshold?: number;
    height?: number;
}

const W = 200;

export function Spark({ values, threshold, height = 30 }: SparkProps) {
    if (values.length < 2) {
        return <div style={{ height }} aria-hidden="true" />;
    }
    const lo = Math.min(...values, threshold ?? Infinity);
    const hi = Math.max(...values, threshold ?? -Infinity);
    const pad = (hi - lo) * 0.15 || 1;
    const y = (v: number) =>
        height - ((v - (lo - pad)) / (hi + pad - (lo - pad))) * height;
    const d = values
        .map(
            (v, i) =>
                `${i ? 'L' : 'M'}${((i * W) / (values.length - 1)).toFixed(1)} ${y(v).toFixed(1)}`
        )
        .join(' ');
    return (
        <svg
            className="spark"
            viewBox={`0 0 ${String(W)} ${String(height)}`}
            preserveAspectRatio="none"
            style={{ width: '100%', height, display: 'block' }}
            aria-hidden="true"
        >
            {threshold !== undefined && (
                <path
                    d={`M0 ${y(threshold).toFixed(1)}H${String(W)}`}
                    stroke="var(--warn)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    vectorEffect="non-scaling-stroke"
                />
            )}
            <path
                d={`${d} L${String(W)} ${String(height)} L0 ${String(height)} Z`}
                fill="var(--sparkFill)"
            />
            <path
                d={d}
                fill="none"
                stroke="var(--c1)"
                strokeWidth="1.5"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}
