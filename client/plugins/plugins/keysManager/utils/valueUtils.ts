import type { ZSetMember } from './types';

export interface ZSetParseResult {
    formatted: string;
    jsonMap: Record<string, any>;
    hasJson: boolean;
}

export interface ZSetMembersParseResult {
    members: ZSetMember[];
    invalidScores: number;
    hasDanglingMember: boolean;
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
    if (type === 'hash' && value && typeof value === 'object') {
        return Object.entries(value)
            .map(([key, val]) => `${key}: ${val}`)
            .join('\n');
    }
    if ((type === 'list' || type === 'set') && Array.isArray(value)) {
        return value.map((item, i) => `${i + 1}) ${item}`).join('\n');
    }
    if (type === 'zset' && Array.isArray(value)) {
        return value.length
            ? value.map((e) => `• ${e.member} → ${e.score}`).join('\n')
            : 'Empty sorted set';
    }
    if (type === 'stream' && Array.isArray(value)) {
        return value
            .map((e) => `${e.id} ${JSON.stringify(e.fields)}`)
            .join('\n');
    }
    return String(value);
};

/**
 * Parse ZSet value for the viewer modal, handling JSON parsing
 */
export const parseZsetForViewer = (
    entries: { member: string; score: number }[]
): ZSetParseResult => {
    const formattedLines: string[] = [];
    const jsonMap: Record<string, any> = {};
    let hasJson = false;

    for (const { member, score } of entries) {
        try {
            const parsed = JSON.parse(member);
            formattedLines.push(
                `• ${JSON.stringify(parsed, null, 2)} → ${score}`
            );
            jsonMap[String(score)] = parsed;
            hasJson = true;
        } catch {
            formattedLines.push(`• ${member} → ${score}`);
        }
    }

    return {
        formatted: formattedLines.join('\n\n'),
        jsonMap,
        hasJson
    };
};

export const parseZsetMembersFromText = (
    value: string
): ZSetMembersParseResult => {
    const lines = value
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '');
    const members: ZSetMember[] = [];
    let invalidScores = 0;

    for (let i = 0; i < lines.length; i += 2) {
        const member = lines[i];
        const scoreLine = lines[i + 1];

        if (!member || scoreLine === undefined) {
            continue;
        }

        const score = Number(scoreLine);
        if (!Number.isFinite(score)) {
            invalidScores += 1;
            continue;
        }

        members.push({ score, value: member });
    }

    return {
        members,
        invalidScores,
        hasDanglingMember: lines.length % 2 !== 0
    };
};

/**
 * Prepare value data for the viewer modal
 */
export const prepareValueForViewer = (
    value: any,
    type: string
): ValueModalData => {
    try {
        let formatted = '';
        let jsonData = null;
        let hasJson = false;

        if (type === 'zset' && Array.isArray(value)) {
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
