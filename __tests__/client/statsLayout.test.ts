import {
    BOARDS,
    boardById,
    loadRemoved,
    saveRemoved
} from '@/pages/Statistics/boards';

beforeEach(() => localStorage.clear());

describe('stats boards and layout', () => {
    it('defines overview and memory boards, unknown ids fall back to overview', () => {
        expect(BOARDS.map((b) => b.id)).toEqual(['overview', 'memory']);
        expect(boardById('memory').title).toBe('Memory deep-dive');
        expect(boardById('nope').id).toBe('overview');
        expect(boardById(undefined).id).toBe('overview');
    });

    it('persists removed widgets per connection and board', () => {
        saveRemoved('local', 'overview', ['chart-ops']);
        expect(loadRemoved('local', 'overview')).toEqual(['chart-ops']);
        expect(loadRemoved('local', 'memory')).toEqual([]);
        expect(loadRemoved('prod', 'overview')).toEqual([]);
    });

    it('survives corrupt storage', () => {
        localStorage.setItem('redisdeck-stats-layout:local:overview', '{x');
        expect(loadRemoved('local', 'overview')).toEqual([]);
    });
});
