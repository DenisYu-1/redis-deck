export interface ZSetMember {
    score: number;
    value: string;
}

export interface ZSetParseResult {
    formatted: string;
    jsonMap: Record<string, any>;
    hasJson: boolean;
}

export interface ValueModalData {
    formatted: string;
    jsonData: any;
    hasJson: boolean;
    activeTab: string;
}

/**
 * Format Redis key values for display based on their type
 */
export const formatValue = (type: string, value: any): string => {
    if (type === 'hash') {
        // Format hash values as key-value pairs
        if (typeof value === 'object' && value !== null) {
            // Already processed into object format
            return Object.entries(value)
                .map(([key, val]) => `${key}: ${val}`)
                .join('\n');
        } else if (typeof value === 'string') {
            // Raw string format
            const lines = value.split('\n');
            let formatted = '';
            for (let i = 0; i < lines.length; i += 2) {
                if (lines[i]?.trim() && i + 1 < lines.length) {
                    formatted += `${lines[i]}: ${lines[i + 1]}\n`;
                }
            }
            return formatted;
        }
        return String(value);
    } else if (type === 'list' || type === 'set') {
        // Format list or set as numbered items
        if (typeof value === 'string') {
            const items = value.split('\n').filter((item) => item.trim());
            return items
                .map((item, index) => `${index + 1}) ${item}`)
                .join('\n');
        } else if (Array.isArray(value)) {
            return value
                .map((item, index) => `${index + 1}) ${item}`)
                .join('\n');
        }
        return String(value);
    } else if (type === 'zset') {
        // Format sorted set with scores in a more readable way
        if (typeof value === 'string') {
            const lines = value
                .split('\n')
                .filter((line) => line.trim() !== '');
            if (lines.length === 0) {
                return 'Empty sorted set';
            }

            let formatted = '';
            for (let i = 0; i < lines.length; i += 2) {
                if (
                    lines[i]?.trim() &&
                    i + 1 < lines.length &&
                    lines[i + 1]
                ) {
                    const member = lines[i]!.trim();
                    const score = lines[i + 1]!.trim();
                    formatted += `• ${member} → ${score}\n`;
                }
            }
            return formatted || 'Empty sorted set';
        }
        return String(value);
    }

    // Default for string and other types
    return String(value);
};

/**
 * Parse ZSet value for the viewer modal, handling JSON parsing
 */
export const parseZsetForViewer = (value: string): ZSetParseResult => {
    const lines = value.split('\n').filter((line) => line.trim());
    const formattedLines: string[] = [];
    const jsonMap: Record<string, any> = {};
    let hasJson = false;

    for (let i = 0; i < lines.length; i += 2) {
        if (i + 1 < lines.length) {
            const member = lines[i]!.trim();
            const score = lines[i + 1]!.trim();

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
};

/**
 * Prepare value data for the viewer modal
 */
export const prepareValueForViewer = (value: any, type: string): ValueModalData => {
    try {
        let formatted = '';
        let jsonData = null;
        let hasJson = false;

        if (type === 'zset' && typeof value === 'string') {
            const result = parseZsetForViewer(value);
            formatted = result.formatted;

            if (result.hasJson) {
                jsonData = result.jsonMap;
                hasJson = true;
            }
        } else if (typeof value === 'string') {
            try {
                jsonData = JSON.parse(value);
                hasJson = true;
                formatted = JSON.stringify(jsonData, null, 2);
            } catch {
                formatted = value;
            }
        } else if (
            Array.isArray(value) ||
            (typeof value === 'object' && value !== null)
        ) {
            jsonData = value;
            hasJson = true;
            formatted = JSON.stringify(value, null, 2);
        } else {
            formatted = String(value);
        }

        return {
            formatted,
            jsonData,
            hasJson,
            activeTab: hasJson ? 'tree' : 'formatted'
        };
    } catch (error) {
        throw new Error('Failed to display value');
    }
};

/**
 * Copy value to clipboard
 */
export const copyValueToClipboard = async (value: any): Promise<void> => {
    try {
        let textToCopy = '';

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
    } catch (error) {
        throw new Error('Failed to copy value');
    }
};