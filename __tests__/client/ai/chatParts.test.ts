import { transcriptOf, type ChatMessage } from '@/utils/chatParts';

test('the transcript keeps what each tool call and approval card came to', () => {
    const messages: ChatMessage[] = [
        { role: 'user', text: 'Delete test:k' },
        {
            role: 'assistant',
            parts: [
                { type: 'text', text: 'Looking.' },
                {
                    type: 'tool',
                    id: 't1',
                    tool: 'get_key',
                    args: { key: 'test:k' },
                    status: 'ok',
                    ms: 3,
                    response: '{"value":"secret"}'
                },
                {
                    type: 'approval',
                    id: 'a1',
                    tool: 'delete_key',
                    connectionId: 'local',
                    title: 'Delete test:k',
                    commands: ['DEL test:k'],
                    state: 'denied'
                },
                {
                    type: 'approval',
                    id: 'a2',
                    tool: 'rename_key',
                    connectionId: 'local',
                    title: 'Rename test:k',
                    commands: ['RENAME test:k b'],
                    state: 'approved',
                    error: 'no such key'
                },
                { type: 'text', text: 'Not deleted.' }
            ]
        }
    ];

    expect(transcriptOf(messages)[1]).toEqual({
        role: 'assistant',
        text: [
            'Looking.',
            '[Tool call get_key {"key":"test:k"}: ok]',
            '[Write delete_key on local (DEL test:k): denied]',
            '[Write rename_key on local (RENAME test:k b): approved, failed]',
            'Not deleted.'
        ].join('\n\n')
    });
});

test('long tool arguments are cut', () => {
    const [turn] = transcriptOf([
        {
            role: 'assistant',
            parts: [
                {
                    type: 'tool',
                    id: 't1',
                    tool: 'set_key',
                    args: { value: 'x'.repeat(5000) },
                    status: 'denied'
                }
            ]
        }
    ]);

    expect(turn?.text.length).toBeLessThan(300);
    expect(turn?.text).toMatch(/…: denied\]$/);
});
