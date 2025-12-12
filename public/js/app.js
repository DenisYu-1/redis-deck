/**
 * Main Application Entry Point
 * Initializes all components and manages app state
 */
import { PluginManager } from './plugins/PluginManager.js';
import * as Environment from './components/environment.js';
import * as KeyList from './components/keyList.js';
import * as KeyDetails from './components/keyDetails.js';
import * as EmptyState from './components/emptyState.js';
import { showToast } from './utils/domUtils.js';
import { loadEnvironments } from './services/apiService.js';

const pluginManager = new PluginManager();

document.addEventListener('DOMContentLoaded', async () => {
    setupModalCloseButtons();
    await checkConnectionsAndInitialize();
});

async function checkConnectionsAndInitialize() {
    try {
        const connections = await loadEnvironments();

        const mainContent = document.getElementById('main-content');
        const connectionInfo = document.querySelector('.connection-info');

        if (!connections || connections.length === 0) {
            EmptyState.init();
            EmptyState.show();
        } else {
            EmptyState.hide();
            mainContent.style.display = 'block';
            if (connectionInfo) {
                connectionInfo.style.display = 'flex';
            }

            Environment.init(handleEnvironmentChange);
            KeyList.init(handleKeySelection);
            KeyDetails.init();

            const context = {
                Environment,
                KeyList,
                KeyDetails,
                onOperationComplete: handleKeyOperationComplete,
                showToast,
                getCurrentEnvironment: () => Environment.getCurrentEnvironment()
            };

            await pluginManager.loadAllPlugins(context);

            setTimeout(() => {
                refreshKeyList();
            }, 500);
        }
    } catch (error) {
        console.error('Error checking connections:', error);
        showToast('Error loading connections', 'error');
    }
}

/**
 * Handle environment change event
 * @param {string} environmentId - New environment ID
 */
function handleEnvironmentChange() {
    // Reset key details
    KeyDetails.resetKeyDetails();

    // Reset and reload key list
    refreshKeyList();
}

/**
 * Handle key selection event
 * @param {string} key - Selected Redis key
 */
function handleKeySelection(key) {
    // Load key details
    const environment = Environment.getCurrentEnvironment();
    KeyDetails.loadKeyDetails(key, environment, refreshKeyList);
}

/**
 * Refresh the key list and related stats
 * @param {boolean} preservePagination - Whether to preserve current pagination state
 */
function refreshKeyList(preservePagination = false) {
    try {
        const environment = Environment.getCurrentEnvironment();

        // Update loading status
        document.getElementById('total-keys-count').textContent =
            'Total Keys: Loading...';

        // Test connection first
        Environment.testConnection(environment)
            .then((connected) => {
                if (connected) {
                    // Connection successful

                    // Get total key count
                    import('./services/apiService.js').then((api) => {
                        api.getKeyCount(environment)
                            .then((data) => {
                                document.getElementById(
                                    'total-keys-count'
                                ).textContent =
                                    `Total Keys: ${data.count.toLocaleString()}`;
                            })
                            .catch((error) => {
                                document.getElementById(
                                    'total-keys-count'
                                ).textContent = 'Total Keys: Error';
                                console.error(
                                    'Error getting key count:',
                                    error
                                );
                            });
                    });

                    // Search for keys - preserve pagination if requested
                    if (preservePagination) {
                        // Just refresh the currently visible keys without resetting pagination
                        return KeyList.refreshCurrentView(environment);
                    } else {
                        // Full search with pagination reset
                        return KeyList.search(environment);
                    }
                } else {
                    document.getElementById('total-keys-count').textContent =
                        'Total Keys: N/A';
                    showToast(
                        'Connection failed. Please check your Redis connection settings.',
                        'error'
                    );
                }
            })
            .catch((error) => {
                document.getElementById('total-keys-count').textContent =
                    'Total Keys: N/A';
                showToast('Error refreshing data: ' + error.message, 'error');
                console.error('Error refreshing data:', error);
            });
    } catch (error) {
        document.getElementById('total-keys-count').textContent =
            'Total Keys: N/A';
        showToast('Error refreshing data: ' + error.message, 'error');
        console.error('Error refreshing data:', error);
    }
}

/**
 * Handle key operation completion with selective refresh
 * Refreshes the UI after key operations while preserving pagination when possible
 */
function handleKeyOperationComplete() {
    // Refresh key list but preserve pagination state
    refreshKeyList(true);
}

/**
 * Set up close buttons for all modals
 */
function setupModalCloseButtons() {
    const closeModalButtons = document.querySelectorAll('.close-modal');
    closeModalButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            document.getElementById('set-ttl-modal').classList.add('hidden');
            document.getElementById('rename-key-modal').classList.add('hidden');
            document.getElementById('copy-key-modal').classList.add('hidden');
        });
    });
}
