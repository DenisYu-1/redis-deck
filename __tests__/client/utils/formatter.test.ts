import { formatBytes, formatNumber, formatPercentage, escapeHTML } from '@/utils/formatter';

describe('formatter utilities', () => {
    describe('formatBytes', () => {
        it('formats bytes correctly', () => {
            expect(formatBytes(0)).toBe('0 B');
            expect(formatBytes(1024)).toBe('1 KB');
            expect(formatBytes(1048576)).toBe('1 MB');
            expect(formatBytes(1073741824)).toBe('1 GB');
        });
    });

    describe('formatNumber', () => {
        it('formats numbers with commas', () => {
            expect(formatNumber(1000)).toBe('1,000');
            expect(formatNumber(1000000)).toBe('1,000,000');
        });
    });

    describe('formatPercentage', () => {
        it('formats percentage with 2 decimals', () => {
            expect(formatPercentage(50.5)).toBe('50.50%');
            expect(formatPercentage(99.999)).toBe('100.00%');
        });
    });

    describe('escapeHTML', () => {
        it('escapes HTML entities', () => {
            expect(escapeHTML('<script>alert("xss")</script>')).toContain('&lt;');
            expect(escapeHTML('<script>alert("xss")</script>')).toContain('&gt;');
        });
    });
});

