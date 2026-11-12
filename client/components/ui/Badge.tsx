export type RedisType =
    'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream' | 'json';

/** Key-type badge, coloured by the `--t-*` tokens. */
export function Badge({ type }: { type: RedisType }) {
    return <span className={`badge b-${type}`}>{type}</span>;
}

/** Connection tier badge (local / staging / production). */
export function TierBadge({
    tier
}: {
    tier: 'local' | 'staging' | 'production';
}) {
    return (
        <span className={`env ${tier}`}>
            {tier === 'production' ? 'prod' : tier}
        </span>
    );
}
