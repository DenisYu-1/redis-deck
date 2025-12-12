/**
 * Key Details Component
 * Manages the details view of a Redis key and related operations
 */
import {
    getKeyDetails,
    deleteKey,
    renameKey,
    setKeyExpiry,
    copyKey
} from '../services/apiService.js';
import {
    formatValue,
    formatTtl,
    getDisplayTypeName
} from '../utils/dataFormatter.js';
import { showToast, escapeHTML } from '../utils/domUtils.js';
import * as Environment from '../components/environment.js';

// DOM elements
let keyInfo;
let keyActions;
let keyTtl;
let currentKeyData = null;
let refreshCallback = null;

/**
 * Initialize the key details component
 */
export function init() {
    // Get DOM elements
    keyInfo = document.getElementById('key-info');
    keyActions = document.getElementById('key-actions');
    keyTtl = document.getElementById('key-ttl');

    // Action buttons
    const deleteKeyBtn = document.getElementById('delete-key-btn');
    const renameKeyBtn = document.getElementById('rename-key-btn');
    const copyKeyBtn = document.getElementById('copy-key-btn');
    const setTtlBtn = document.getElementById('set-ttl-btn');

    // Modal elements
    const applyTtlBtn = document.getElementById('apply-ttl-btn');
    const cancelTtlBtn = document.getElementById('cancel-ttl-btn');

    const applyRenameBtn = document.getElementById('apply-rename-btn');
    const cancelRenameBtn = document.getElementById('cancel-rename-btn');

    const applyCopyBtn = document.getElementById('apply-copy-btn');
    const cancelCopyBtn = document.getElementById('cancel-copy-btn');

    // Action event listeners
    deleteKeyBtn.addEventListener('click', () => {
        handleDeleteKey(Environment.getCurrentEnvironment(), refreshCallback);
    });
    renameKeyBtn.addEventListener('click', openRenameModal);
    copyKeyBtn.addEventListener('click', openCopyModal);
    setTtlBtn.addEventListener('click', openTtlModal);

    // Modal actions
    applyTtlBtn.addEventListener('click', () => {
        handleApplyTtl(Environment.getCurrentEnvironment(), refreshCallback);
    });
    cancelTtlBtn.addEventListener('click', () =>
        document.getElementById('set-ttl-modal').classList.add('hidden')
    );

    applyRenameBtn.addEventListener('click', () => {
        handleApplyRename(Environment.getCurrentEnvironment(), refreshCallback);
    });
    cancelRenameBtn.addEventListener('click', () =>
        document.getElementById('rename-key-modal').classList.add('hidden')
    );

    applyCopyBtn.addEventListener('click', () => {
        handleApplyCopy(Environment.getCurrentEnvironment(), refreshCallback);
    });
    cancelCopyBtn.addEventListener('click', () =>
        document.getElementById('copy-key-modal').classList.add('hidden')
    );

    setupViewValueModal();
    setupModalEscapeKey();
}

/**
 * Setup view value modal close handlers
 * @private
 */
function setupViewValueModal() {
    const viewValueModal = document.getElementById('view-value-modal');
    const closeBtn = viewValueModal.querySelector('.close-modal');

    const closeModal = () => {
        viewValueModal.classList.add('hidden');
    };

    closeBtn.addEventListener('click', closeModal);

    viewValueModal.addEventListener('click', (e) => {
        if (e.target === viewValueModal) {
            closeModal();
        }
    });

    const tabButtons = viewValueModal.querySelectorAll('.value-tab-btn');
    tabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;

            tabButtons.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');

            const tabContents =
                viewValueModal.querySelectorAll('.value-tab-content');
            tabContents.forEach((content) => {
                if (content.dataset.content === tabName) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });
}

/**
 * Setup ESC key to close all modals
 * @private
 */
function setupModalEscapeKey() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modals = [
                'view-value-modal',
                'set-ttl-modal',
                'rename-key-modal',
                'copy-key-modal'
            ];

            modals.forEach((modalId) => {
                const modal = document.getElementById(modalId);
                if (modal && !modal.classList.contains('hidden')) {
                    modal.classList.add('hidden');
                }
            });
        }
    });
}

/**
 * Load and display details for a selected key
 * @param {string} key - Redis key
 * @param {string} environment - Current environment ID
 * @param {Function} onRefresh - Callback to execute to refresh the key list
 */
export async function loadKeyDetails(key, environment, onRefresh) {
    if (!key) return;

    try {
        // Store the refresh callback for later use
        refreshCallback = onRefresh;

        keyInfo.innerHTML = '<p>Loading key details...</p>';
        keyActions.classList.add('hidden');

        const data = await getKeyDetails(key, environment);

        currentKeyData = data;
        displayKeyDetails(data);
    } catch (error) {
        keyInfo.innerHTML = `<p class="error">Error: ${error.message}</p>`;
        keyActions.classList.add('hidden');
        console.error('Error fetching key details:', error);
    }
}

/**
 * Reset the key details view
 */
export function resetKeyDetails() {
    keyInfo.innerHTML = '<p>Select a key to view details</p>';
    keyActions.classList.add('hidden');
    currentKeyData = null;
}

/**
 * Display key details in the UI
 * @param {Object} data - Key details from API
 * @private
 */
function displayKeyDetails(data) {
    const { key, type, value, ttl } = data;

    // Update TTL display
    keyTtl.textContent = formatTtl(ttl);

    let detailsHTML = `
        <div class="key-header">
            <strong>Key:</strong> ${escapeHTML(key)}<br>
            <strong>Type:</strong> ${escapeHTML(getDisplayTypeName(type))}
        </div>
        <div class="key-value">
            <div class="key-value-header">
                <strong>Value:</strong>
                <div class="value-actions">
                    <button class="value-action-btn" id="view-value-btn" title="View formatted value">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                    <button class="value-action-btn" id="copy-value-btn" title="Copy value">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <pre>${formatValue(type, value)}</pre>
        </div>
    `;

    keyInfo.innerHTML = detailsHTML;

    const viewValueBtn = document.getElementById('view-value-btn');
    const copyValueBtn = document.getElementById('copy-value-btn');

    if (viewValueBtn) {
        viewValueBtn.addEventListener('click', () =>
            handleViewValue(value, type)
        );
    }

    if (copyValueBtn) {
        copyValueBtn.addEventListener('click', () =>
            handleCopyValue(value, type)
        );
    }

    keyActions.classList.remove('hidden');
}

/* Modal handling functions */

/**
 * Open the Set TTL modal
 * @private
 */
function openTtlModal() {
    if (!currentKeyData) return;

    const setTtlModal = document.getElementById('set-ttl-modal');
    const ttlKeyName = document.getElementById('ttl-key-name');
    const ttlSeconds = document.getElementById('ttl-seconds');

    ttlKeyName.textContent = currentKeyData.key;
    ttlSeconds.value = ''; // Default to empty
    setTtlModal.classList.remove('hidden');
}

/**
 * Apply TTL to the current key
 * @param {string} environment - Current environment ID
 * @param {Function} onRefresh - Callback to refresh key list
 * @private
 */
async function handleApplyTtl(environment, _onRefresh) {
    if (!currentKeyData) return;

    const setTtlModal = document.getElementById('set-ttl-modal');
    const ttlSeconds = document.getElementById('ttl-seconds');
    const seconds = ttlSeconds.value.trim();

    if (seconds === '') {
        showToast('Please enter a TTL value', 'error');
        return;
    }

    try {
        await setKeyExpiry(currentKeyData.key, parseInt(seconds), environment);

        const secondsValue = parseInt(seconds);
        const message =
            secondsValue < 0
                ? `Expiry removed from key "${currentKeyData.key}"`
                : `Expiry set to ${seconds} seconds for key "${currentKeyData.key}"`;

        showToast(message, 'success');

        // Update the TTL display
        keyTtl.textContent = formatTtl(secondsValue);

        // Close the modal
        setTtlModal.classList.add('hidden');
    } catch (error) {
        showToast(error.message, 'error');
        console.error('Error setting TTL:', error);
    }
}

/**
 * Open the Rename Key modal
 * @private
 */
function openRenameModal() {
    if (!currentKeyData) return;

    const renameKeyModal = document.getElementById('rename-key-modal');
    const renameCurrentKey = document.getElementById('rename-current-key');
    const renameNewKey = document.getElementById('rename-new-key');

    renameCurrentKey.textContent = currentKeyData.key;
    renameNewKey.value = currentKeyData.key; // Default to current key name
    renameKeyModal.classList.remove('hidden');
}

/**
 * Apply rename to the current key
 * @param {string} environment - Current environment ID
 * @param {Function} onRefresh - Callback to refresh key list
 * @private
 */
async function handleApplyRename(environment, onRefresh) {
    if (!currentKeyData) return;

    const renameKeyModal = document.getElementById('rename-key-modal');
    const renameNewKey = document.getElementById('rename-new-key');
    const newKey = renameNewKey.value.trim();

    if (!newKey) {
        showToast('New key name is required', 'error');
        return;
    }

    try {
        await renameKey(currentKeyData.key, newKey, environment);

        showToast(
            `Key renamed from "${currentKeyData.key}" to "${newKey}"`,
            'success'
        );

        // Reset the current key and UI
        resetKeyDetails();

        // Refresh the key list with pagination preservation
        if (onRefresh) onRefresh(true);

        // Close the modal
        renameKeyModal.classList.add('hidden');
    } catch (error) {
        showToast(error.message, 'error');
        console.error('Error renaming key:', error);
    }
}

/**
 * Open the Copy Key modal
 * @private
 */
function openCopyModal() {
    if (!currentKeyData) return;

    const copyKeyModal = document.getElementById('copy-key-modal');
    const copySourceKey = document.getElementById('copy-source-key');
    const copyTargetKey = document.getElementById('copy-target-key');
    const copyTargetEnv = document.getElementById('copy-target-env');

    // Set current key in the modal
    copySourceKey.textContent = currentKeyData.key;

    // Default to the same key name
    copyTargetKey.value = currentKeyData.key;

    // Set default target env to current environment
    copyTargetEnv.value = environment;

    // Show the modal
    copyKeyModal.classList.remove('hidden');
}

/**
 * Apply copy to the current key
 * @param {string} environment - Current environment ID
 * @param {Function} onRefresh - Callback to refresh key list
 * @private
 */
async function handleApplyCopy(environment, onRefresh) {
    if (!currentKeyData) return;

    const copyKeyModal = document.getElementById('copy-key-modal');
    const copyTargetKey = document.getElementById('copy-target-key');
    const copyTargetEnv = document.getElementById('copy-target-env');

    const targetKey = copyTargetKey.value.trim();
    const targetEnv = copyTargetEnv.value;

    if (!targetKey) {
        showToast('Target key name is required', 'error');
        return;
    }

    try {
        await copyKey(currentKeyData.key, targetKey, targetEnv, environment);

        const message =
            targetEnv === environment
                ? `Key copied to "${targetKey}" in the same environment`
                : `Key copied to "${targetKey}" in ${targetEnv} environment`;

        showToast(message, 'success');

        // If copying to the same environment, refresh the key list with pagination preservation
        if (targetEnv === environment && onRefresh) {
            onRefresh(true);
        }

        // Close the modal
        copyKeyModal.classList.add('hidden');
    } catch (error) {
        showToast(error.message, 'error');
        console.error('Error copying key:', error);
    }
}

/**
 * Delete the currently selected key
 * @param {string} environment - Current environment ID
 * @param {Function} onRefresh - Callback to refresh key list
 * @private
 */
async function handleDeleteKey(environment, onRefresh) {
    if (!currentKeyData) return;

    if (
        !confirm(
            `Are you sure you want to delete the key "${currentKeyData.key}"?`
        )
    ) {
        return;
    }

    try {
        await deleteKey(currentKeyData.key, environment);

        showToast(
            `Key "${currentKeyData.key}" deleted successfully`,
            'success'
        );

        // Reset key details
        resetKeyDetails();

        // Refresh the key list with pagination preservation
        if (onRefresh) onRefresh(true);
    } catch (error) {
        showToast(error.message, 'error');
        console.error('Error deleting key:', error);
    }
}

/**
 * View the value in a formatted modal
 * @param {*} value - Value to display
 * @param {string} type - Redis key type
 * @private
 */
function handleViewValue(value, type) {
    const viewValueModal = document.getElementById('view-value-modal');
    const jsonViewer = document.getElementById('value-viewer-json');
    const rawViewer = document.getElementById('value-viewer-raw');
    const treeTabBtn = viewValueModal.querySelector('[data-tab="tree"]');

    try {
        let isJsonCompatible = false;
        let dataToDisplay = null;

        if (type === 'zset' && typeof value === 'string') {
            const result = parseZsetForViewer(value);
            rawViewer.textContent = result.formatted;

            if (result.hasJson) {
                dataToDisplay = result.jsonMap;
                isJsonCompatible = true;
            }
        } else if (typeof value === 'string') {
            try {
                dataToDisplay = JSON.parse(value);
                isJsonCompatible = true;
            } catch {
                rawViewer.textContent = value;
            }
        } else if (
            Array.isArray(value) ||
            (typeof value === 'object' && value !== null)
        ) {
            dataToDisplay = value;
            isJsonCompatible = true;
        } else {
            rawViewer.textContent = String(value);
        }

        if (isJsonCompatible) {
            rawViewer.textContent = JSON.stringify(dataToDisplay, null, 2);
            jsonViewer.data = dataToDisplay;
        }

        showViewerModal(
            viewValueModal,
            treeTabBtn,
            isJsonCompatible,
            jsonViewer
        );
    } catch (error) {
        showToast('Failed to display value', 'error');
        console.error('Error displaying value:', error);
    }
}

/**
 * Parse zset value for viewer display
 * @param {string} value - Raw zset value
 * @returns {Object} Parsed result with formatted text and JSON map
 * @private
 */
function parseZsetForViewer(value) {
    const lines = value.split('\n').filter((line) => line.trim());
    const formattedLines = [];
    const jsonMap = {};
    let hasJson = false;

    for (let i = 0; i < lines.length; i += 2) {
        if (i + 1 < lines.length) {
            const member = lines[i].trim();
            const score = lines[i + 1].trim();

            try {
                const parsed = JSON.parse(member);
                formattedLines.push(
                    `• ${JSON.stringify(parsed, null, 2)} → ${score}`
                );
                jsonMap[score] = parsed;
                hasJson = true;
            } catch {
                formattedLines.push(`• ${member} → ${score}`);
            }
        }
    }

    return {
        formatted: formattedLines.join('\n\n'),
        jsonMap,
        hasJson
    };
}

/**
 * Show the viewer modal with appropriate tab selection
 * @param {HTMLElement} modal - Modal element
 * @param {HTMLElement} treeTabBtn - Tree tab button
 * @param {boolean} hasJson - Whether data is JSON-compatible
 * @param {HTMLElement} jsonViewer - JSON viewer component
 * @private
 */
function showViewerModal(modal, treeTabBtn, hasJson, jsonViewer) {
    const tabButtons = modal.querySelectorAll('.value-tab-btn');
    const tabContents = modal.querySelectorAll('.value-tab-content');
    const activeTab = hasJson ? 'tree' : 'formatted';

    treeTabBtn.style.display = hasJson ? 'inline-block' : 'none';

    tabButtons.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === activeTab);
    });

    tabContents.forEach((content) => {
        content.classList.toggle(
            'active',
            content.dataset.content === activeTab
        );
    });

    modal.classList.remove('hidden');

    if (hasJson) {
        setTimeout(() => jsonViewer.expandAll?.(), 100);
    }
}

/**
 * Copy the value to clipboard
 * @param {*} value - Value to copy
 * @param {string} _type - Redis key type
 * @private
 */
async function handleCopyValue(value, _type) {
    try {
        let textToCopy;

        if (typeof value === 'string') {
            textToCopy = value;
        } else if (Array.isArray(value)) {
            textToCopy = JSON.stringify(value, null, 2);
        } else if (typeof value === 'object' && value !== null) {
            textToCopy = JSON.stringify(value, null, 2);
        } else {
            textToCopy = String(value);
        }

        await navigator.clipboard.writeText(textToCopy);
        showToast('Value copied to clipboard', 'success');
    } catch (error) {
        showToast('Failed to copy value', 'error');
        console.error('Error copying value:', error);
    }
}
