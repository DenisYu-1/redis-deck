import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyDetail } from '@/pages/Keys/KeyDetail';
import type { KeyDetails, KeyInfo } from '@/types';

const info: KeyInfo = {
    type: 'hash',
    encoding: 'listpack',
    idle: 12,
    memory: 2048,
    length: 2
};

function show(details: KeyDetails, meta: KeyInfo | null = info) {
    return render(
        <KeyDetail
            keyName={details.key}
            details={details}
            info={meta}
            loading={false}
            error={null}
            onReload={jest.fn()}
        />
    );
}

test('header shows type, muted prefix, TTL and server meta', () => {
    show({
        key: 'user:1:profile',
        type: 'hash',
        ttl: 90,
        value: { a: '1', b: '2' }
    });
    expect(screen.getByText('hash')).toBeInTheDocument();
    expect(screen.getByText('user:1:')).toHaveClass('mu');
    expect(screen.getByText('listpack')).toBeInTheDocument();
    expect(screen.getByText('1m')).toBeInTheDocument();
    expect(screen.getByText('12s')).toBeInTheDocument();
    expect(screen.getByText('Fields')).toBeInTheDocument();
});

test('hash filter narrows rows by field or value', async () => {
    show({
        key: 'h',
        type: 'hash',
        ttl: -1,
        value: { name: 'Ann', city: 'Paris' }
    });
    await userEvent.type(screen.getByLabelText('Filter'), 'par');
    expect(screen.queryByText('name')).not.toBeInTheDocument();
    expect(screen.getByText('city')).toBeInTheDocument();
});

test('picking a row decodes its value in the inspector', async () => {
    show({
        key: 'h',
        type: 'hash',
        ttl: -1,
        value: { cfg: '{"on":true}' }
    });
    await userEvent.click(screen.getByText('cfg'));
    expect(screen.getByText('Auto · JSON')).toBeInTheDocument();
    expect(screen.getByText(/"on": true/)).toBeInTheDocument();
});

test('string value is decoded as PHP when serialized', () => {
    show(
        { key: 's', type: 'string', ttl: -1, value: 'a:1:{s:1:"x";i:5;}' },
        { ...info, type: 'string', length: 18 }
    );
    expect(screen.getByText('Auto · PHP')).toBeInTheDocument();
    expect(screen.getByText(/"x": 5/)).toBeInTheDocument();
});

test('zset rows get a date hint for timestamp scores', async () => {
    show({
        key: 'z',
        type: 'zset',
        ttl: -1,
        value: [{ member: 'job', score: 1700000000 }]
    });
    expect(screen.getByText('2023-11-14 22:13:20 UTC')).toBeInTheDocument();
});

test('stream is shown read-only as raw JSON', () => {
    show({
        key: 'x',
        type: 'stream',
        ttl: -1,
        value: [{ id: '1-0', fields: { f: 'v' } }]
    });
    expect(screen.getByText('stream (read-only)')).toBeInTheDocument();
});
