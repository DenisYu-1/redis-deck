import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '@/App';
import {
    answerAiApproval,
    streamAiChat,
    type ChatApproval,
    type ChatEvent
} from '@/services/aiChat';

jest.mock('@/pages/Keys/KeysPage', () => ({
    KeysPage: () => <div>KEYS PAGE</div>
}));
jest.mock('@/services/aiChat');
jest.mock('@/services/apiService', () => ({
    loadEnvironments: jest
        .fn()
        .mockResolvedValue([
            { id: 'local', host: 'h1', port: 6379, tier: 'local' }
        ]),
    getWorkflows: jest.fn().mockResolvedValue([]),
    getKeyCount: jest.fn().mockResolvedValue({ count: 1 }),
    getServerStatus: jest.fn().mockResolvedValue({}),
    getAiModel: jest.fn().mockResolvedValue({
        mode: 'api',
        provider: 'anthropic',
        model: 'claude-sonnet-5-5',
        models: ['claude-sonnet-5-5'],
        keyLast4: '9F2c'
    }),
    listAiAccess: jest
        .fn()
        .mockResolvedValue([
            { id: 'local', write: true, workflows: false, ask: true }
        ])
}));

const stream = jest.mocked(streamAiChat);
const answered = jest.mocked(answerAiApproval);

const card = (
    id: string,
    state: ChatApproval['state'],
    more: Partial<ChatApproval> = {}
): ChatApproval => ({
    type: 'approval',
    id,
    tool: 'set_ttl',
    connectionId: 'local',
    title: `Write ${id}`,
    commands: [`EXPIRE ${id} 60`, `PERSIST ${id}`],
    state,
    ...more
});

test('approval cards: Approve, Deny, their outcomes, and closing the chat', async () => {
    const user = userEvent.setup();
    let emit: (event: ChatEvent) => void = () => {};
    stream.mockImplementation((_, options) => {
        emit = options.onEvent;
        return new Promise<void>(() => {});
    });
    answered.mockResolvedValue();
    render(
        <MemoryRouter initialEntries={['/keys']}>
            <AppRoutes />
        </MemoryRouter>
    );

    await user.click(
        await screen.findByRole('button', { name: /Open assistant/ })
    );
    const chat = within(
        screen.getByRole('complementary', { name: 'Assistant' })
    );
    expect(
        await chat.findByText('Writes wait for your approval')
    ).toBeVisible();
    await user.type(
        chat.getByRole('textbox', { name: /message/i }),
        'expire them{Enter}'
    );
    const chatId = stream.mock.calls[0]?.[0].chatId;
    const group = (id: string) =>
        within(chat.getByRole('group', { name: `Write ${id}` }));

    act(() => emit(card('a', 'pending')));
    const a = group('a');
    expect(a.getByText(/EXPIRE a 60/)).toHaveTextContent(
        'EXPIRE a 60 PERSIST a'
    );
    expect(a.getByText(/via MCP tool/)).toHaveTextContent(
        'via MCP tool set_ttl on local'
    );
    await user.click(a.getByRole('button', { name: 'Approve' }));
    expect(answered).toHaveBeenLastCalledWith({
        chatId,
        id: 'a',
        approved: true
    });
    // One answer per card.
    expect(a.getByRole('button', { name: 'Deny' })).toBeDisabled();
    act(() => emit(card('a', 'approved', { done: 'TTL set' })));
    expect(a.getByText('Approved · TTL set')).toBeVisible();
    expect(a.queryByRole('button')).not.toBeInTheDocument();

    act(() => emit(card('b', 'pending')));
    await user.click(group('b').getByRole('button', { name: 'Deny' }));
    expect(answered).toHaveBeenLastCalledWith({
        chatId,
        id: 'b',
        approved: false
    });
    act(() => emit(card('b', 'denied')));
    expect(group('b').getByText('Denied')).toBeVisible();

    act(() => {
        emit(card('c', 'blocked', { reason: 'tool is turned off' }));
        emit(
            card('d', 'auto', {
                reason: 'Ask before writes is off for local',
                done: 'TTL set'
            })
        );
        emit(card('e', 'approved', { error: 'ERR no such key' }));
    });
    expect(group('c').getByText('Blocked')).toBeVisible();
    expect(group('c').getByText('tool is turned off')).toBeVisible();
    expect(group('d').getByText('Ran without asking · TTL set')).toBeVisible();
    expect(
        group('d').getByText('Ask before writes is off for local')
    ).toBeVisible();
    expect(group('e').getByText('Approved · failed')).toBeVisible();
    expect(group('e').getByText('ERR no such key')).toBeVisible();

    // Closing the chat denies what waits, and what is proposed while closed.
    act(() => emit(card('f', 'pending')));
    answered.mockClear();
    await user.click(chat.getByRole('button', { name: 'Close assistant' }));
    expect(answered.mock.calls).toEqual([
        [{ chatId, id: 'f', approved: false }]
    ]);

    answered.mockClear();
    act(() => {
        emit(card('f', 'denied'));
        emit(card('g', 'pending'));
    });
    expect(answered.mock.calls).toEqual([
        [{ chatId, id: 'g', approved: false }]
    ]);
});
