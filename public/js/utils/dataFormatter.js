/**
 * Utilities for formatting Redis data
 */
import { escapeHTML } from './domUtils.js';

/**
 * Format Redis value based on its type
 * @param {string} type - Redis data type
 * @param {string} value - Raw string value from Redis
 * @returns {string} - Formatted HTML-safe string
 */
export function formatValue(type, value) {
    if (type === 'hash') {
        // Format hash values as key-value pairs
        const lines = value.split('\n');
        let formatted = '';
        for (let i = 0; i < lines.length; i += 2) {
            if (lines[i].trim() && i + 1 < lines.length) {
                formatted += `${escapeHTML(lines[i])}: ${escapeHTML(lines[i + 1])}\n`;
            }
        }
        return formatted;
    } else if (type === 'list' || type === 'set') {
        // Format list or set as numbered items
        const items = value.split('\n').filter((item) => item.trim());
        return items
            .map((item, index) => `${index + 1}) ${escapeHTML(item)}`)
            .join('\n');
    } else if (type === 'zset') {
        // Format sorted set with scores in a more readable way
        const lines = value.split('\n').filter((line) => line.trim() !== '');
        if (lines.length === 0) {
            return 'Empty sorted set';
        }

        let formatted = '';
        for (let i = 0; i < lines.length; i += 2) {
            if (lines[i].trim() && i + 1 < lines.length) {
                const member = lines[i].trim();
                const score = lines[i + 1].trim();

                formatted += `• ${escapeHTML(member)} → ${escapeHTML(score)}\n`;
            }
        }
        return formatted || 'Empty sorted set';
    }

    // Default for string and other types
    return escapeHTML(value);
}

/**
 * Format TTL value for display
 * @param {number} ttl - TTL value in seconds
 * @returns {string} - Formatted TTL string
 */
export function formatTtl(ttl) {
    if (ttl > 0) {
        return `${ttl} seconds`;
    } else if (ttl === -2) {
        return 'Key does not exist';
    } else {
        return 'No expiration';
    }
}

/**
 * Parse Redis zset value string into array of {score, value} objects
 * @param {string} value - Raw zset value from Redis (member\nscore\nmember\nscore...)
 * @returns {Array} Array of {score: number, value: string} objects
 */
export function parseZsetValue(value) {
    const members = [];
    const lines = value.split('\n').filter((line) => line.trim() !== '');

    for (let i = 0; i < lines.length; i += 2) {
        if (i + 1 < lines.length) {
            const member = lines[i].trim();
            const score = parseFloat(lines[i + 1].trim());

            if (!isNaN(score)) {
                members.push({
                    value: member,
                    score: score
                });
            }
        }
    }

    return members;
}

/**
 * Parse Redis hash value string into key-value object
 * @param {string} value - Raw hash value from Redis
 * @returns {Object} Object with hash field-value pairs
 */
export function parseHashValue(value) {
    if (typeof value === 'object') {
        return value; // Already parsed
    }

    const hash = {};
    const lines = value.split('\n').filter((line) => line.trim() !== '');

    for (let i = 0; i < lines.length; i += 2) {
        if (i + 1 < lines.length) {
            const field = lines[i].trim();
            const val = lines[i + 1].trim();
            hash[field] = val;
        }
    }

    return hash;
}

/**
 * Parse Redis list/set value string into array
 * @param {string} value - Raw list/set value from Redis
 * @returns {Array} Array of string values
 */
export function parseListSetValue(value) {
    return value
        .split('\n')
        .filter((item) => item.trim() !== '')
        .map((item) => item.trim());
}

/**
 * Get a user-friendly type name for display
 * @param {string} type - Redis data type
 * @returns {string} - Formatted type name
 */
export function getDisplayTypeName(type) {
    const typeNames = {
        string: 'String',
        zset: 'Sorted Set',
        hash: 'Hash',
        list: 'List',
        set: 'Set'
    };

    return typeNames[type] || type.charAt(0).toUpperCase() + type.slice(1);
}
