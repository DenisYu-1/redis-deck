export interface ZSetMember {
    score: number;
    value: string;
}

export type KeyType = 'string' | 'zset' | 'hash' | 'list' | 'set';

export interface KeyDetails {
    key: string;
    type: string;
    value: any;
    ttl: number | null;
}

export interface ValueModalData {
    formatted: string;
    jsonData: any;
    hasJson: boolean;
    activeTab: string;
}

export interface SearchKeysResult {
    keys: string[];
    cursors: string[];
    hasMore: boolean;
}