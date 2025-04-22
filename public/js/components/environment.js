/**
 * Environment Component
 * Manages Redis environment selection and connection status
 */
import { loadEnvironments, checkConnection } from '../services/apiService.js';

// State
let currentEnvironment = 'staging';
let onEnvironmentChangeCallback = null;

/**
 * Initialize the environment component
 * @param {Function} onEnvironmentChange - Callback to execute when environment changes
 */
export function init(onEnvironmentChange) {
    onEnvironmentChangeCallback = onEnvironmentChange;

    // Get DOM elements
    const environmentSelect = document.getElementById('environment-select');

    // Event listeners
    environmentSelect.addEventListener('change', handleEnvironmentChange);

    // Load available environments
    loadAvailableEnvironments().then(() => {
        // Check initial connection
        testConnection().then(success => {
            // Call the callback on initial load to trigger keys request
            if (success && onEnvironmentChangeCallback) {
                onEnvironmentChangeCallback(currentEnvironment);
            }
        });
    });
}

/**
 * Get the current environment ID
 * @returns {string} - Current environment ID
 */
export function getCurrentEnvironment() {
    if (!currentEnvironment) {
        console.error('No current environment set, defaulting to staging');
        return 'staging'; // Provide a default value if currentEnvironment is not set
    }
    return currentEnvironment;
}

/**
 * Load available environments from the server
 */
async function loadAvailableEnvironments() {
    const environmentSelect = document.getElementById('environment-select');
    const environments = await loadEnvironments();

    // Clear existing options first
    environmentSelect.innerHTML = '';

    if (environments && environments.length > 0) {
        // Add options for each environment
        environments.forEach(env => {
            if (env.host) {
                const option = document.createElement('option');
                option.value = env.id;
                option.textContent = `${env.id} (${env.host}${env.tls ? ' TLS' : ''})`;
                environmentSelect.appendChild(option);
            }
        });

        // Set the current environment from the select
        currentEnvironment = environmentSelect.value;
    } else {
        // If no environments are returned, add a default staging environment
        const option = document.createElement('option');
        option.value = 'staging';
        option.textContent = 'staging (localhost)';
        environmentSelect.appendChild(option);

        // Set the default environment
        currentEnvironment = 'staging';
    }

}

/**
 * Handle environment selection change
 */
function handleEnvironmentChange() {
    const environmentSelect = document.getElementById('environment-select');
    currentEnvironment = environmentSelect.value;

    // Test the new connection
    testConnection();

    // Notify about the environment change
    if (onEnvironmentChangeCallback) {
        onEnvironmentChangeCallback(currentEnvironment);
    }
}

/**
 * Test the current Redis connection
 */
export async function testConnection() {
    try {
        // Check connection
        await checkConnection(currentEnvironment);

        return true;
    } catch (error) {
        console.error('Connection error:', error);
        return false;
    }
}
