export function EmptyState() {
    return (
        <section className="empty-state" id="empty-state">
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: '4em', marginBottom: '20px' }}>📭</div>
                <h2 style={{ marginBottom: '15px' }}>
                    No Redis Connections Configured
                </h2>
                <p
                    style={{
                        color: 'var(--text-secondary)',
                        marginBottom: '30px'
                    }}
                >
                    To get started, please add a Redis connection in the
                    settings page.
                </p>
                <a href="/settings" className="button">
                    ⚙️ Go to Settings
                </a>
            </div>
        </section>
    );
}
