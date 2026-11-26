import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsolePage } from '@/pages/Console/ConsolePage';

jest.mock('@/services/apiService', () => ({ runConsole: jest.fn() }));

beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

const editor = () =>
    screen.getByRole<HTMLTextAreaElement>('textbox', {
        name: /redis commands/i
    });
const tab = (name: string) => screen.getByRole('tab', { name });
const tabNames = () => screen.getAllByRole('tab').map((t) => t.textContent);

function setup() {
    const user = userEvent.setup();
    const view = render(<ConsolePage />);
    return { user, ...view };
}

const newTab = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: 'New console' }));

it('adds a tab with its own editor text', async () => {
    const { user } = setup();
    await user.type(editor(), 'PING');
    await newTab(user);

    expect(tabNames()).toEqual(['console-1.redis', 'console-2.redis']);
    expect(tab('console-2.redis')).toHaveAttribute('aria-selected', 'true');
    expect(editor()).toHaveValue('');
    await user.type(editor(), 'DBSIZE');

    await user.click(tab('console-1.redis'));
    expect(editor()).toHaveValue('PING');
    await user.click(tab('console-2.redis'));
    expect(editor()).toHaveValue('DBSIZE');
});

const closeTab = (user: ReturnType<typeof userEvent.setup>, name: string) =>
    user.click(screen.getByRole('button', { name: `Close ${name}` }));

it('closes an empty tab at once and shows another one', async () => {
    const { user } = setup();
    await newTab(user);
    await closeTab(user, 'console-2.redis');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(tabNames()).toEqual(['console-1.redis']);
    expect(tab('console-1.redis')).toHaveAttribute('aria-selected', 'true');
});

it('asks before it discards the commands of a tab', async () => {
    const { user } = setup();
    await newTab(user);
    await user.type(editor(), 'DBSIZE');

    await closeTab(user, 'console-2.redis');
    const dialog = screen.getByRole('dialog', {
        name: 'Close console-2.redis?'
    });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(editor()).toHaveValue('DBSIZE');

    await closeTab(user, 'console-2.redis');
    await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
            name: 'Close'
        })
    );
    expect(tabNames()).toEqual(['console-1.redis']);
    expect(editor()).toHaveValue('');
});

it('keeps at least one tab', async () => {
    const { user } = setup();
    await closeTab(user, 'console-1.redis');
    expect(tabNames()).toEqual(['console-1.redis']);
});

it.each(['double-click', 'F2'])('renames a tab with %s', async (how) => {
    const { user } = setup();
    if (how === 'F2') {
        tab('console-1.redis').focus();
        await user.keyboard('{F2}');
    } else {
        await user.dblClick(tab('console-1.redis'));
    }
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, '  queues.redis {Enter}');

    expect(tabNames()).toEqual(['queues.redis']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('does not accept an empty name', async () => {
    const { user } = setup();
    await user.dblClick(tab('console-1.redis'));
    await user.clear(screen.getByRole('textbox', { name: 'Name' }));
    await user.click(screen.getByRole('button', { name: 'Rename' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name');
    expect(tabNames()).toEqual(['console-1.redis']);
});

it('keeps names, text and the open tab after a reload', async () => {
    const { user, unmount } = setup();
    await user.type(editor(), 'PING');
    await newTab(user);
    await user.type(editor(), 'DBSIZE');
    await user.dblClick(tab('console-2.redis'));
    await user.clear(screen.getByRole('textbox', { name: 'Name' }));
    await user.type(
        screen.getByRole('textbox', { name: 'Name' }),
        'size.redis{Enter}'
    );
    unmount();
    setup();

    expect(tabNames()).toEqual(['console-1.redis', 'size.redis']);
    expect(tab('size.redis')).toHaveAttribute('aria-selected', 'true');
    expect(editor()).toHaveValue('DBSIZE');
});

it.each(['getItem', 'setItem'] as const)(
    'still works when localStorage %s throws',
    async (method) => {
        jest.spyOn(Storage.prototype, method).mockImplementation(() => {
            throw new Error('blocked');
        });
        const { user } = setup();
        await user.type(editor(), 'PING');
        await newTab(user);
        await user.click(tab('console-1.redis'));

        expect(editor()).toHaveValue('PING');
    }
);

it.each([
    'not json',
    'null',
    '{"tabs":[],"activeId":1}',
    '{"tabs":[{"id":1,"name":2}],"activeId":1}'
])('starts fresh when the stored value is %s', (stored) => {
    localStorage.setItem('redisdeck-console-tabs', stored);
    setup();

    expect(tabNames()).toEqual(['console-1.redis']);
    expect(editor()).toHaveValue('');
});
