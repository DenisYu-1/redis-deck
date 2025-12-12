/**
 * Key List Component
 * Manages the list of Redis keys, search, and pagination
 */
import { searchKeys } from '../services/apiService.js';
import { updatePaginationInfo } from '../utils/domUtils.js';
import * as Environment from '../components/environment.js';

// State
let currentPattern = '*';
let cursors = ['0']; // Array of cursors for multi-cursor pagination
let currentCursorIndex = 0; // Index of the current cursor in the array
let loadedKeysCount = 0;
let allKeys = [];
let isLoading = false;
let currentKey = null;
let onKeySelectedCallback = null;

// Virtual list configuration
let virtualListConfig = {
    itemHeight: 30, // estimated height of each key item in pixels
    visibleItems: 50, // approximate number of items to render at once
    bufferItems: 20, // extra items to render above/below viewport for smooth scrolling
    scrollTop: 0, // current scroll position
    containerHeight: 400, // default height of the visible container
    maxKeyDisplayLength: 100 // maximum number of characters to display for key names
};

/**
 * Initialize the key list component
 * @param {Function} onKeySelected - Callback when a key is selected
 */
export function init(onKeySelected) {
    onKeySelectedCallback = onKeySelected;

    // Get DOM elements
    const searchBtn = document.getElementById('search-btn');
    const showAllBtn = document.getElementById('show-all-btn');
    const keysResults = document.getElementById('keys-results');
    const searchPattern = document.getElementById('search-pattern');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const prevPageBtn =
        document.getElementById('prev-page-btn') ||
        document.createElement('button'); // Fallback if not in DOM
    const nextPageBtn =
        document.getElementById('next-page-btn') ||
        document.createElement('button'); // Fallback if not in DOM

    // Set up virtual list container styles
    setupVirtualListContainer();

    // Event listeners
    searchBtn.addEventListener('click', () =>
        search(Environment.getCurrentEnvironment())
    );
    showAllBtn.addEventListener('click', () =>
        showAll(Environment.getCurrentEnvironment())
    );
    keysResults.addEventListener('click', handleKeySelection);
    loadMoreBtn.addEventListener('click', () =>
        loadMore(Environment.getCurrentEnvironment())
    );

    // Pagination navigation buttons
    if (prevPageBtn.id === 'prev-page-btn') {
        prevPageBtn.addEventListener('click', () =>
            navigateToPreviousCursor(Environment.getCurrentEnvironment())
        );
    }
    if (nextPageBtn.id === 'next-page-btn') {
        nextPageBtn.addEventListener('click', () =>
            navigateToNextCursor(Environment.getCurrentEnvironment())
        );
    }

    // Add scroll event handler for virtual list
    keysResults.addEventListener('scroll', handleListScroll);

    // Handle window resize to adjust virtual list container
    window.addEventListener('resize', () => {
        adjustContainerHeight();
        renderVisibleItems();
    });

    // Press Enter to search
    searchPattern.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            search(Environment.getCurrentEnvironment());
        }
    });

    // Initial container height adjustment
    adjustContainerHeight();
}

/**
 * Setup the virtual list container styles
 */
function setupVirtualListContainer() {
    const keysResults = document.getElementById('keys-results');
    keysResults.style.height = `${virtualListConfig.containerHeight}px`;
    keysResults.style.overflowY = 'auto';
    keysResults.style.position = 'relative';
}

/**
 * Adjust container height based on available space
 */
function adjustContainerHeight() {
    const keysResults = document.getElementById('keys-results');
    const container = keysResults.parentElement;
    const availableHeight =
        window.innerHeight - container.getBoundingClientRect().top - 100; // 100px buffer for bottom

    virtualListConfig.containerHeight = Math.max(300, availableHeight); // Minimum 300px height
    keysResults.style.height = `${virtualListConfig.containerHeight}px`;
}

/**
 * Handle scroll events for virtual list
 */
function handleListScroll() {
    const keysResults = document.getElementById('keys-results');
    virtualListConfig.scrollTop = keysResults.scrollTop;

    // Use requestAnimationFrame for better performance
    requestAnimationFrame(renderVisibleItems);
}

/**
 * Search for keys with the current pattern
 * @param {string} environment - Current environment ID
 */
export async function search(environment) {
    if (isLoading) return;

    const searchPattern = document.getElementById('search-pattern');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const keysResults = document.getElementById('keys-results');

    isLoading = true;
    // Ensure we use '*' as the default pattern when empty
    const pattern = searchPattern.value.trim() || '*';
    currentPattern = pattern;

    // Reset pagination state
    resetPagination();

    loadMoreBtn.disabled = true;
    keysResults.innerHTML = '<li class="loading">Loading keys...</li>';

    try {
        // Check if this is a direct key search (no wildcards) and not the default pattern
        const hasWildcards =
            pattern.includes('*') ||
            pattern.includes('?') ||
            pattern.includes('[');

        if (!hasWildcards) {
            // This is a direct key lookup

            // Import and use getKeyDetails to check if the key exists
            try {
                const apiService = await import('../services/apiService.js');
                await apiService.getKeyDetails(pattern, environment);

                // Key exists, display it
                displayKeys([pattern], true);
                loadMoreBtn.disabled = true; // No pagination for direct lookup
                updatePaginationInfo(1, 1, ['0'], 0);
            } catch {
                // Key doesn't exist
                keysResults.innerHTML =
                    '<li class="no-results">Key not found</li>';
                updatePaginationInfo(0, 0, ['0'], 0);
            }
        } else {
            // This is a pattern search - use SCAN
            // Send entire cursor array to backend, which will use the last one for scanning
            const data = await searchKeys(pattern, cursors, 10000, environment);

            // Update UI with the results
            displayKeys(data.keys, true);

            // Update pagination status
            if (
                data.cursors &&
                Array.isArray(data.cursors) &&
                data.cursors.length > 0
            ) {
                // Backend returns array of cursors (one for each node in cluster mode, or single cursor for standalone)
                cursors = data.cursors;
                currentCursorIndex = 0; // Reset to beginning since we now have the complete cursor state
            }
            loadedKeysCount = data.keys.length;

            // Parse total keys
            let totalKeys = loadedKeysCount;
            if (data.total !== undefined) {
                if (typeof data.total === 'number') {
                    totalKeys = data.total;
                } else if (typeof data.total === 'string') {
                    const numericPart = data.total.replace(/\D/g, '');
                    if (numericPart) {
                        totalKeys = parseInt(numericPart);
                    }
                    if (data.total.includes('?')) {
                        totalKeys = `${totalKeys}+`;
                    }
                }
            }

            // Enable/disable load more button
            loadMoreBtn.disabled = !data.hasMore;

            // Pass the cursors array and current index for display
            updatePaginationInfo(
                totalKeys,
                loadedKeysCount,
                cursors,
                currentCursorIndex
            );

            // If no keys found, show a message
            if (data.keys.length === 0) {
                keysResults.innerHTML =
                    '<li class="no-results">No keys found matching the pattern</li>';
            }
        }
    } catch (error) {
        keysResults.innerHTML = `<li class="error">Error: ${error.message}</li>`;
        console.error('Search error:', error);
    } finally {
        isLoading = false;
    }
}

/**
 * Show all keys (uses * pattern)
 * @param {string} environment - Current environment ID
 */
export async function showAll(environment) {
    const searchPattern = document.getElementById('search-pattern');
    searchPattern.value = '*';
    await search(environment);
}

/**
 * Refresh the current view without resetting pagination
 * This maintains the current cursor and loaded keys while refreshing the display
 * @param {string} environment - Current environment ID
 */
export async function refreshCurrentView(environment) {
    if (isLoading) return;

    // Don't reset pagination state - just re-render what we have
    // This is useful when a key operation might have affected the displayed data
    // but we don't want to lose the user's current position in the list

    if (allKeys.length > 0) {
        // Re-render the current keys
        displayKeys(allKeys, true);

        // Update pagination info with current state
        const loadMoreBtn = document.getElementById('load-more-btn');
        // Check if any cursor has more data (for cluster mode)
        const hasMore = cursors.some((cursor) => cursor !== '0');
        loadMoreBtn.disabled = !hasMore;

        let totalKeys = loadedKeysCount;
        if (hasMore) {
            totalKeys = `${loadedKeysCount}+`;
        }

        updatePaginationInfo(
            totalKeys,
            loadedKeysCount,
            cursors,
            currentCursorIndex
        );
    } else {
        // If no keys are loaded, fall back to a fresh search
        await search(environment);
    }
}

/**
 * Load more keys (continue pagination)
 * @param {string} environment - Current environment ID
 */
export async function loadMore(environment) {
    const loadMoreBtn = document.getElementById('load-more-btn');

    // Check if any cursor has more data (for cluster mode)
    const hasMore = cursors.some((cursor) => cursor !== '0');

    if (isLoading || !hasMore) {
        loadMoreBtn.disabled = true;
        return;
    }

    isLoading = true;
    loadMoreBtn.textContent = 'Loading...';

    try {
        // Send entire cursor array to backend
        const data = await searchKeys(
            currentPattern,
            cursors,
            10000,
            environment
        );

        // Append new keys to the existing list
        displayKeys(data.keys, false);

        // Update pagination status
        if (
            data.cursors &&
            Array.isArray(data.cursors) &&
            data.cursors.length > 0
        ) {
            // Backend returns array of cursors (one for each node in cluster mode, or single cursor for standalone)
            cursors = data.cursors;
        }
        // If we hit the end (cursor '0'), stay at the current index
        // This allows us to potentially go back using previous cursors
        loadedKeysCount += data.keys.length;

        // Parse total keys for display
        let totalKeys = loadedKeysCount;
        if (data.hasMore) {
            totalKeys = `${loadedKeysCount}+`;
        }

        // Enable/disable load more button
        loadMoreBtn.disabled = !data.hasMore;

        updatePaginationInfo(
            totalKeys,
            loadedKeysCount,
            cursors,
            currentCursorIndex
        );
    } catch (error) {
        console.error('Error loading more keys:', error);
        throw error;
    } finally {
        isLoading = false;
        loadMoreBtn.textContent = 'Load More';
    }
}

/**
 * Reset the current key selection and pagination
 */
export function resetPagination() {
    cursors = ['0']; // Reset to initial cursor
    currentCursorIndex = 0;
    loadedKeysCount = 0;
    allKeys = [];

    const keysResults = document.getElementById('keys-results');
    keysResults.innerHTML = '';

    // Reset current key
    currentKey = null;

    // Reset scroll position
    virtualListConfig.scrollTop = 0;
    if (keysResults) {
        keysResults.scrollTop = 0;
    }
}

/**
 * Get the currently selected key
 * @returns {string|null} - Selected key or null if none
 */
export function getSelectedKey() {
    return currentKey;
}

/**
 * Handle key selection event
 * @param {Event} e - Click event
 * @private
 */
function handleKeySelection(e) {
    if (e.target.tagName === 'LI' && e.target.dataset.key) {
        const selectedKey = e.target.dataset.key;

        // Highlight selected key - only need to update class for visible elements
        const keysResults = document.getElementById('keys-results');
        const items = keysResults.querySelectorAll('li');
        items.forEach((item) => item.classList.remove('active'));
        e.target.classList.add('active');

        currentKey = selectedKey;

        // Call the callback if provided
        if (onKeySelectedCallback) {
            onKeySelectedCallback(selectedKey);
        }
    }
}

/**
 * Display keys in the UI
 * @param {string[]} keys - Array of keys to display
 * @param {boolean} resetList - Whether to reset the existing list
 * @private
 */
function displayKeys(keys, resetList) {
    const keysCount = document.getElementById('keys-count');

    // Filter out empty keys
    const validKeys = keys.filter((key) => key && key.trim() !== '');

    if (resetList) {
        allKeys = [];

        // Clear the DOM
        const keysResults = document.getElementById('keys-results');
        keysResults.innerHTML = '';
    }

    // Add new keys to our tracking array
    allKeys = [...allKeys, ...validKeys];

    keysCount.textContent = `(${allKeys.length})`;

    if (allKeys.length === 0 && validKeys.length === 0) {
        const keysResults = document.getElementById('keys-results');
        keysResults.innerHTML = '<li class="no-results">No keys found</li>';
        return;
    }

    // Create virtual list container if needed
    const keysResults = document.getElementById('keys-results');
    if (!keysResults.querySelector('.virtual-list-container')) {
        const container = document.createElement('div');
        container.className = 'virtual-list-container';
        container.style.position = 'relative';
        keysResults.appendChild(container);
    }

    // Render only the visible items
    renderVisibleItems();
}

/**
 * Render only the visible items in the virtual list
 */
function renderVisibleItems() {
    const keysResults = document.getElementById('keys-results');
    const container =
        keysResults.querySelector('.virtual-list-container') || keysResults;

    // If no keys or still loading, don't render
    if (allKeys.length === 0) {
        return;
    }

    // Calculate visible range
    const scrollTop = virtualListConfig.scrollTop;
    const startIndex = Math.max(
        0,
        Math.floor(scrollTop / virtualListConfig.itemHeight) -
            virtualListConfig.bufferItems
    );
    const endIndex = Math.min(
        allKeys.length,
        startIndex +
            Math.ceil(
                virtualListConfig.containerHeight / virtualListConfig.itemHeight
            ) +
            virtualListConfig.bufferItems
    );

    // Set container height to accommodate all items
    container.style.height = `${allKeys.length * virtualListConfig.itemHeight}px`;

    // Clear existing items - we'll re-render everything in the visible range
    container.innerHTML = '';

    // Render only the visible items
    for (let i = startIndex; i < endIndex; i++) {
        const key = allKeys[i];
        const li = document.createElement('li');

        // Truncate long key names
        if (key.length > virtualListConfig.maxKeyDisplayLength) {
            // Truncate the middle part of the key
            const halfLength = Math.floor(
                virtualListConfig.maxKeyDisplayLength / 2
            );
            const firstPart = key.substring(0, halfLength);
            const lastPart = key.substring(key.length - halfLength);
            li.textContent = `${firstPart}…${lastPart}`;
            li.classList.add('truncated-key');
        } else {
            li.textContent = key;
        }

        // Store full key in data attribute
        li.dataset.key = key;
        li.dataset.index = i;

        // Add title attribute for tooltip on hover
        li.title = key;

        // Position absolutely
        li.style.position = 'absolute';
        li.style.top = `${i * virtualListConfig.itemHeight}px`;
        li.style.width = '100%';
        li.style.height = `${virtualListConfig.itemHeight}px`;
        li.style.overflow = 'hidden';
        li.style.textOverflow = 'ellipsis';
        li.style.whiteSpace = 'nowrap';

        // Add active class if this is the currently selected key
        if (key === currentKey) {
            li.classList.add('active');
        }

        container.appendChild(li);
    }
}

/**
 * Scroll to a specific key in the list
 * @param {string} key - The key to scroll to
 */
export function scrollToKey(key) {
    const index = allKeys.indexOf(key);
    if (index !== -1) {
        const keysResults = document.getElementById('keys-results');
        keysResults.scrollTop = index * virtualListConfig.itemHeight;
    }
}

/**
 * Navigate to a previous cursor in the pagination history
 * @param {string} environment - Current environment ID
 * @returns {Promise<void>}
 */
export async function navigateToPreviousCursor(environment) {
    // For cluster mode (multiple cursors), navigation is complex since each node has its own cursor
    // For simplicity, we'll reset to the beginning
    if (cursors.length > 1) {
        // Multiple cursors indicate cluster mode - reset to beginning
        resetPagination();
        await search(environment);
        return;
    }

    // Single cursor mode (standalone Redis)
    if (isLoading || currentCursorIndex <= 0) {
        return; // Already at first cursor or loading
    }

    isLoading = true;

    try {
        // Move back one cursor in our array
        currentCursorIndex--;

        // We need to reset and replay from the beginning to this cursor
        allKeys = [];
        loadedKeysCount = 0;

        // Use a slice of the cursors array up to the current index
        const currentCursors = cursors.slice(0, currentCursorIndex + 1);

        const keysResults = document.getElementById('keys-results');
        keysResults.innerHTML = '<li class="loading">Loading keys...</li>';

        // Just send the sliced cursors array
        const data = await searchKeys(
            currentPattern,
            currentCursors,
            10000,
            environment
        );

        // Accumulate keys
        if (data.keys && data.keys.length > 0) {
            displayKeys(data.keys, true); // Reset display since we're going back
            loadedKeysCount = data.keys.length;
        }

        // Update pagination display
        updatePaginationInfo(
            loadedKeysCount,
            loadedKeysCount,
            cursors,
            currentCursorIndex
        );
    } catch (error) {
        console.error('Error navigating to previous cursor:', error);
        throw error;
    } finally {
        isLoading = false;
    }
}

/**
 * Navigate to the next cursor in the pagination history
 * @param {string} environment - Current environment ID
 * @returns {Promise<void>}
 */
export async function navigateToNextCursor(environment) {
    // For cluster mode (multiple cursors), just load more
    if (cursors.length > 1) {
        await loadMore(environment);
        return;
    }

    // Single cursor mode (standalone Redis)
    if (
        isLoading ||
        currentCursorIndex >= cursors.length - 1 ||
        cursors[currentCursorIndex] === '0'
    ) {
        return; // Already at last cursor or loading
    }

    // Just load more since we're at the current end
    await loadMore(environment);
}
