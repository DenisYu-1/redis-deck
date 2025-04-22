/**
 * Service for API communication
 */

/**
 * Create a URL with environment parameter and other query params
 * @param {string} base - Base URL path
 * @param {Object} params - Additional query parameters
 * @param {string} environment - Current environment ID
 * @returns {string} - Complete URL with parameters
 */
export function createApiUrl(base, params = {}, environment) {
    const url = new URL(base, window.location.origin);

    // Only append environment if it's defined
    if (environment) {
        url.searchParams.append('env', environment);
    }

    // Add any other parameters
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
            url.searchParams.append(key, value);
        }
    });

    return url.toString();
}

/**
 * Load available environments
 * @returns {Promise<Array>} - List of environments
 */
export async function loadEnvironments() {
    try {
        const response = await fetch('/api/environments');

        if (response.ok) {
            const data = await response.json();
            return data.environments || [];
        }

        return [];
    } catch (error) {
        console.error('Error loading environments:', error);
        return [];
    }
}

/**
 * Check connection to Redis
 * @param {string} environment - Current environment ID
 * @returns {Promise<Object>} - Connection status
 */
export async function checkConnection(environment) {
    const url = createApiUrl('/api/health', {}, environment);
    const response = await fetch(url);

    if (response.ok) {
        return await response.json();
    }

    throw new Error('Connection failed');
}

/**
 * Get total key count from Redis
 * @param {string} environment - Current environment ID
 * @returns {Promise<Object>} - Key count information
 */
export async function getKeyCount(environment) {
    const url = createApiUrl('/api/keycount', {}, environment);
    const response = await fetch(url);

    if (response.ok) {
        return await response.json();
    }

    throw new Error('Failed to fetch key count');
}

/**
 * Search for keys matching pattern
 * @param {string} pattern - Key pattern to search for
 * @param {string|string[]} cursors - Pagination cursor or array of cursors (for cluster mode)
 * @param {number} count - Number of items to fetch
 * @param {string} environment - Current environment ID
 * @returns {Promise<Object>} - Search results with keys and pagination info
 */
export async function searchKeys(pattern, cursors, count, environment) {
    // Ensure cursors is always an array
    const cursorArray = Array.isArray(cursors) ? cursors : [cursors || '0'];

    const url = createApiUrl('/api/keys', {
        pattern: pattern,
        cursors: JSON.stringify(cursorArray), // Send as JSON array (supports both single node and cluster)
        count: count
    }, environment);

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('Failed to fetch keys');
    }

    return await response.json();
}

/**
 * Get details for a specific key
 * @param {string} key - Redis key
 * @param {string} environment - Current environment ID
 * @returns {Promise<Object>} - Key details including type, value and TTL
 */
export async function getKeyDetails(key, environment) {
    const url = createApiUrl(`/api/keys/${encodeURIComponent(key)}`, {}, environment);
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('Failed to fetch key details');
    }

    return await response.json();
}

/**
 * Delete a key
 * @param {string} key - Redis key to delete
 * @param {string} environment - Current environment ID
 * @returns {Promise<Object>} - Deletion result
 */
export async function deleteKey(key, environment) {
    const url = createApiUrl(`/api/keys/${encodeURIComponent(key)}`, {}, environment);
    const response = await fetch(url, {
        method: 'DELETE'
    });

    if (!response.ok) {
        throw new Error('Failed to delete key');
    }

    return await response.json();
}

/**
 * Add or update a key
 * @param {string} key - Redis key
 * @param {string} value - Value to set
 * @param {number|undefined} expiry - Optional expiration time in seconds
 * @param {string} environment - Current environment ID
 * @returns {Promise<Object>} - Operation result
 */
export async function saveKey(key, value, expiry, environment) {
    const url = createApiUrl('/api/keys', {}, environment);
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            key,
            value,
            expiry: expiry ? parseInt(expiry) : undefined
        })
    });

    if (!response.ok) {
        throw new Error('Failed to save key');
    }

    return await response.json();
}

/**
 * Delete keys by pattern
 * @param {string} pattern - Key pattern to match
 * @param {string} environment - Current environment ID
 * @returns {Promise<Object>} - Deletion result
 */
export async function deleteKeysByPattern(pattern, environment) {
    const url = createApiUrl('/api/allkeys', {
        pattern: pattern
    }, environment);

    const response = await fetch(url, {
        method: 'DELETE'
    });

    if (!response.ok) {
        throw new Error('Failed to delete keys');
    }

    return await response.json();
}

/**
 * Set expiry (TTL) for a key
 * @param {string} key - Redis key
 * @param {number} seconds - Expiry time in seconds (-1 to remove expiry)
 * @param {string} environment - Current environment ID
 * @returns {Promise<Object>} - Operation result
 */
export async function setKeyExpiry(key, seconds, environment) {
    const url = createApiUrl(`/api/keys/${encodeURIComponent(key)}/expire`, {}, environment);
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            seconds: parseInt(seconds)
        })
    });

    if (!response.ok) {
        throw new Error('Failed to set expiry');
    }

    return await response.json();
}

/**
 * Rename a key
 * @param {string} key - Current Redis key
 * @param {string} newKey - New key name
 * @param {string} environment - Current environment ID
 * @returns {Promise<Object>} - Operation result
 */
export async function renameKey(key, newKey, environment) {
    const url = createApiUrl(`/api/keys/${encodeURIComponent(key)}/rename`, {}, environment);
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            newKey
        })
    });

    if (!response.ok) {
        throw new Error('Failed to rename key');
    }

    return await response.json();
}

/**
 * Copy a key
 * @param {string} key - Source Redis key
 * @param {string} targetKey - Target key name
 * @param {string} targetEnv - Target environment ID
 * @param {string} environment - Current environment ID
 * @returns {Promise<Object>} - Operation result
 */
export async function copyKey(key, targetKey, targetEnv, environment) {
    const url = createApiUrl(`/api/keys/${encodeURIComponent(key)}/copy`, {}, environment);
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            targetKey,
            targetEnv
        })
    });

    if (!response.ok) {
        throw new Error('Failed to copy key');
    }

    return await response.json();
}

/**
 * Get Redis server information
 * @param {string} environment - Current environment ID
 * @returns {Promise<Object>} - Redis INFO command result
 */
export async function getRedisInfo(environment) {
    const url = createApiUrl('/api/info', {}, environment);
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('Failed to fetch Redis information');
    }

    return await response.json();
}

/**
 * Flush current database (delete all keys)
 * @param {string} environment - Current environment ID
 * @returns {Promise<Object>} - Flush operation result
 */
export async function flushDatabase(environment) {
    const url = createApiUrl('/api/flush', {}, environment);
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            confirm: true
        })
    });

    if (!response.ok) {
        throw new Error('Failed to flush environment');
    }

    return await response.json();
}

/**
 * Add members to a sorted set (ZSET)
 * @param {string} key - Redis key
 * @param {Array} members - Array of objects with {score: number, value: string} properties
 * @param {number|undefined} expiry - Optional expiration time in seconds
 * @param {string} environment - Current environment ID
 * @returns {Promise<Object>} - Operation result
 */
export async function addToSortedSet(key, members, expiry, environment) {
    const url = createApiUrl(`/api/keys/${encodeURIComponent(key)}/zadd`, {}, environment);
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            members,
            expiry: expiry ? parseInt(expiry) : undefined
        })
    });

    if (!response.ok) {
        throw new Error('Failed to add to sorted set');
    }

    return await response.json();
}

/**
 * Check if a key exists
 * @param {string} key - Key to check
 * @param {string} environment - Current environment ID
 * @returns {Promise<boolean>} - True if the key exists, false otherwise
 */
export async function keyExists(key, environment) {
    const url = createApiUrl(`/api/keys/${encodeURIComponent(key)}/exists`, {}, environment);
    try {
        const response = await fetch(url);

        if (response.ok) {
            const data = await response.json();
            return data.exists;
        }

        return false;
    } catch (error) {
        console.error('Error checking key existence:', error);
        return false;
    }
}
