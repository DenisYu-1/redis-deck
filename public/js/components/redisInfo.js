/**
 * Redis Info Component
 * Manages displaying Redis server information
 */
import { getRedisInfo } from '../services/apiService.js';

/**
 * Initialize the Redis info component
 */
export function init() {
    // Get DOM elements
    const showInfoBtn = document.getElementById('show-info-btn');
    const redisInfoModal = document.getElementById('redis-info-modal');
    const closeInfoBtn = document.getElementById('close-info-btn');

    // Event listeners
    showInfoBtn.addEventListener('click', () => showRedisInfo());
    closeInfoBtn.addEventListener('click', () => redisInfoModal.classList.add('hidden'));
}

/**
 * Show Redis server information
 * @param {string} environment - Current environment ID
 */
async function showRedisInfo(environment) {
    try {
        const redisInfoModal = document.getElementById('redis-info-modal');
        const redisInfoContent = document.getElementById('redis-info-content');

        // Show loading state
        redisInfoContent.innerHTML = '<p>Loading Redis server information...</p>';
        redisInfoModal.classList.remove('hidden');

        const data = await getRedisInfo(environment);

        // Format the Redis info into sections
        let infoHtml = '';

        for (const section in data) {
            if (Object.hasOwnProperty.call(data, section)) {
                infoHtml += `<div class="info-section">
                    <h4>${section.charAt(0).toUpperCase() + section.slice(1)}</h4>`;

                for (const key in data[section]) {
                    if (Object.hasOwnProperty.call(data[section], key)) {
                        infoHtml += `<div class="info-row">
                            <div class="info-key">${key}</div>
                            <div class="info-value">${data[section][key]}</div>
                        </div>`;
                    }
                }

                infoHtml += '</div>';
            }
        }

        redisInfoContent.innerHTML = infoHtml;
    } catch (error) {
        const redisInfoContent = document.getElementById('redis-info-content');
        redisInfoContent.innerHTML = `<p class="error">Error loading Redis information: ${error.message}</p>`;
        console.error('Error loading Redis info:', error);
    }
}
