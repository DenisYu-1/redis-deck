/**
 * Empty State Component
 * Displays when no Redis connections are configured
 */

export function init() {
    const emptyStateHTML = `
        <div class="empty-state-content">
            <div class="empty-state-icon">
                <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                    <rect x="10" y="30" width="100" height="70" rx="8" fill="var(--bg-card)" stroke="var(--border-primary)" stroke-width="3"/>
                    <line x1="35" y1="40" x2="35" y2="90" stroke="var(--border-secondary)" stroke-width="2"/>
                    <line x1="60" y1="40" x2="60" y2="90" stroke="var(--border-secondary)" stroke-width="2"/>
                    <line x1="85" y1="40" x2="85" y2="90" stroke="var(--border-secondary)" stroke-width="2"/>
                    <line x1="20" y1="55" x2="100" y2="55" stroke="var(--border-secondary)" stroke-width="2"/>
                    <line x1="20" y1="75" x2="100" y2="75" stroke="var(--border-secondary)" stroke-width="2"/>
                    <circle cx="35" cy="55" r="5" fill="var(--text-tertiary)" opacity="0.3"/>
                    <circle cx="60" cy="55" r="5" fill="var(--text-tertiary)" opacity="0.3"/>
                    <circle cx="85" cy="55" r="5" fill="var(--text-tertiary)" opacity="0.3"/>
                    <circle cx="35" cy="75" r="5" fill="var(--text-tertiary)" opacity="0.3"/>
                    <circle cx="60" cy="75" r="5" fill="var(--text-tertiary)" opacity="0.3"/>
                    <circle cx="85" cy="75" r="5" fill="var(--text-tertiary)" opacity="0.3"/>
                    <line x1="50" y1="10" x2="70" y2="10" stroke="var(--text-tertiary)" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
                    <line x1="60" y1="0" x2="60" y2="20" stroke="var(--text-tertiary)" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
                </svg>
            </div>
            <h2 class="empty-state-title">No Redis Connections</h2>
            <p class="empty-state-description">
                Get started by adding your first Redis connection.<br>
                You'll be able to browse keys, manage data, and monitor your Redis instances.
            </p>
            <button id="add-first-connection-btn" class="add-connection-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Add Connection
            </button>
        </div>
    `;

    const emptyStateContainer = document.getElementById('empty-state');
    emptyStateContainer.innerHTML = emptyStateHTML;

    const addConnectionBtn = document.getElementById('add-first-connection-btn');
    addConnectionBtn.addEventListener('click', () => {
        window.location.href = '/settings.html';
    });
}

export function show() {
    const emptyState = document.getElementById('empty-state');
    emptyState.style.display = 'flex';
}

export function hide() {
    const emptyState = document.getElementById('empty-state');
    emptyState.style.display = 'none';
}

