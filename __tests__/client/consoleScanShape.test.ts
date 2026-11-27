import { scanFrom, tableOf } from '@/pages/Console/shape';
import type { ConsoleResult } from '@/services/apiService';

test('a key scan keeps its key and continues from the new cursor', () => {
    expect(scanFrom('HSCAN user:1 0 COUNT 5', '17')).toBe(
        'HSCAN user:1 17 COUNT 5'
    );
    expect(scanFrom('SSCAN "a b" 0', '3')).toBe('SSCAN "a b" 3');
    expect(scanFrom('SCAN 0 MATCH x*', '9')).toBe('SCAN 9 MATCH x*');
});

test('a key scan is a table of its items', () => {
    const result = {
        text: 'ZSCAN z 0',
        reply: ['4', ['a', '1', 'b', '2']]
    } as unknown as ConsoleResult;
    expect(tableOf(result)).toEqual({
        columns: ['member', 'score'],
        rows: [
            ['a', '1'],
            ['b', '2']
        ],
        cursor: '4'
    });
});
