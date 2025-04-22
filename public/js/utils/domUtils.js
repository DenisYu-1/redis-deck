/**
 * Utility functions for DOM operations
 */

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Optional CSS class to apply
 */
export function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show';

    if (type) {
        toast.classList.add(type);
    }

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
export function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Update pagination information text
 * @param {number|string} totalCount - Total number of items or placeholder text
 * @param {number} loadedCount - Number of items currently loaded
 * @param {string[]} cursors - Array of pagination cursors
 * @param {number} [cursorIndex] - Current index in the cursors array
 */
export function updatePaginationInfo(totalCount, loadedCount, cursors, cursorIndex = 0) {
    const paginationInfo = document.getElementById('pagination-info');

    // Get current cursor from array
    const currentCursor = cursors[cursorIndex];
    const hasMore = currentCursor !== '0';

    if (typeof totalCount === 'number') {
        paginationInfo.textContent = `Showing ${loadedCount} of ${totalCount} keys`;
    } else {
        paginationInfo.innerHTML = `Showing ${loadedCount} keys${hasMore ? '<br>(more available)' : ''}`;
    }
}

