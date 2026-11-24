/**
 * @jest-environment node
 */
const { connectMcp } = require('../helpers/mcpClient');
const {
    addGuardedConnection,
    removeConnections
} = require('../helpers/guardedConnections');
const { getKeyValue, deleteTestKeys } = require('../helpers/testHelpers');
const { setAiAccess } = require('../../services/aiAccess');
const { keyExists } = require('../../services/keyStore');

const CONN = global.TEST_CONNECTION_ID;
const CONFIRM = 'test-mcp-approve';
const CONFIRM_OTHER = 'test-mcp-approve-2';
const HOUR = 60 * 60 * 1000;

// Stub approver: answers from a queue and records every request.
function stubApprover(...answers) {
    return jest.fn(async () => answers.shift() ?? 'deny');
}

function setKey(mcp, value, connectionId = CONFIRM) {
    return mcp.call('set_key', {
        connectionId,
        key: 'test:mcpa:k',
        value
    });
}

describe('MCP approval for Ask before writes', () => {
    let mcp;
    let now;
    const clock = () => now;

    beforeAll(() => {
        addGuardedConnection(CONFIRM, {});
        setAiAccess(CONFIRM, { write: true });
        addGuardedConnection(CONFIRM_OTHER, {});
        setAiAccess(CONFIRM_OTHER, { write: true });
    });

    afterAll(() => {
        removeConnections(CONFIRM, CONFIRM_OTHER);
    });

    beforeEach(async () => {
        now = 1_000_000;
        await deleteTestKeys('test:mcpa:*', CONN);
    });

    afterEach(async () => {
        await mcp?.close();
        mcp = undefined;
        await deleteTestKeys('test:mcpa:*', CONN);
    });

    test('Deny refuses the write with "user denied"', async () => {
        const approver = stubApprover('deny');
        mcp = await connectMcp({ approver, clock });

        const res = await setKey(mcp, 'v');

        expect(res.ok).toBe(false);
        expect(res.error).toMatch(/user denied/i);
        expect(await keyExists(CONN, 'test:mcpa:k')).toBe(false);
    });

    test('the approver is told the AI client, Connection, Tier, operation and Key', async () => {
        const approver = stubApprover('deny');
        mcp = await connectMcp({ approver, clock });

        await setKey(mcp, 'v');

        expect(approver).toHaveBeenCalledWith(
            {
                clientName: 'test-client',
                connectionId: CONFIRM,
                tier: 'production',
                operation: 'set_key',
                target: 'test:mcpa:k',
                targetLabel: 'Key'
            },
            { signal: expect.any(AbortSignal) }
        );
    });

    test('Allow once runs the write and the next write asks again', async () => {
        const approver = stubApprover('once', 'deny');
        mcp = await connectMcp({ approver, clock });

        const first = await setKey(mcp, 'one');
        const second = await setKey(mcp, 'two');

        expect(first.ok).toBe(true);
        expect(second.ok).toBe(false);
        expect(second.error).toMatch(/user denied/i);
        expect(approver).toHaveBeenCalledTimes(2);
        expect(await getKeyValue('test:mcpa:k', CONN)).toBe('one');
    });

    test('Allow for this session skips the prompt until 1 h has passed', async () => {
        const approver = stubApprover('session', 'deny');
        mcp = await connectMcp({ approver, clock });

        expect((await setKey(mcp, 'one')).ok).toBe(true);
        now += HOUR - 1;
        expect((await setKey(mcp, 'two')).ok).toBe(true);
        expect(approver).toHaveBeenCalledTimes(1);
        expect(await getKeyValue('test:mcpa:k', CONN)).toBe('two');

        now += 1;
        const expired = await setKey(mcp, 'three');

        expect(expired.ok).toBe(false);
        expect(approver).toHaveBeenCalledTimes(2);
        expect(await getKeyValue('test:mcpa:k', CONN)).toBe('two');
    });

    test('a session grant covers only its own Connection', async () => {
        const approver = stubApprover('session', 'deny');
        mcp = await connectMcp({ approver, clock });

        await setKey(mcp, 'one', CONFIRM);
        const other = await setKey(mcp, 'two', CONFIRM_OTHER);

        expect(other.ok).toBe(false);
        expect(approver).toHaveBeenCalledTimes(2);
        expect(approver).toHaveBeenLastCalledWith(
            expect.objectContaining({ connectionId: CONFIRM_OTHER }),
            expect.anything()
        );
    });

    test('a session grant ends with the server process', async () => {
        const approver = stubApprover('session', 'deny');
        mcp = await connectMcp({ approver, clock });
        await setKey(mcp, 'one');
        await mcp.close();

        mcp = await connectMcp({ approver, clock });
        const res = await setKey(mcp, 'two');

        expect(res.ok).toBe(false);
        expect(approver).toHaveBeenCalledTimes(2);
    });

    test.each([
        ['an unknown answer', () => 'yes'],
        ['a failing approver', () => Promise.reject(new Error('no display'))]
    ])('%s counts as Deny', async (_label, answer) => {
        mcp = await connectMcp({ approver: jest.fn(answer), clock });

        const res = await setKey(mcp, 'v');

        expect(res.error).toMatch(/user denied/i);
        expect(await keyExists(CONN, 'test:mcpa:k')).toBe(false);
    });

    test('no answer within the approval timeout counts as Deny', async () => {
        const never = jest.fn(() => new Promise(() => {}));
        mcp = await connectMcp({
            approver: never,
            clock,
            approvalTimeoutMs: 20
        });

        const res = await setKey(mcp, 'v');

        expect(res.error).toMatch(/user denied/i);
        expect(await keyExists(CONN, 'test:mcpa:k')).toBe(false);
    });

    test('the approval timeout aborts the signal given to the approver', async () => {
        let signal;
        const never = jest.fn((_request, opts) => {
            signal = opts.signal;
            return new Promise(() => {});
        });
        mcp = await connectMcp({
            approver: never,
            clock,
            approvalTimeoutMs: 20
        });

        await setKey(mcp, 'v');

        expect(signal.aborted).toBe(true);
    });

    test('an answer in time leaves the signal un-aborted', async () => {
        let signal;
        const approver = jest.fn(async (_request, opts) => {
            signal = opts.signal;
            return 'once';
        });
        mcp = await connectMcp({ approver, clock, approvalTimeoutMs: 20 });

        await setKey(mcp, 'v');
        await new Promise((r) => setTimeout(r, 40));

        expect(signal.aborted).toBe(false);
    });

    test('Connections with ask off write without asking', async () => {
        const approver = stubApprover('deny');
        mcp = await connectMcp({ approver, clock });

        const res = await setKey(mcp, 'v', CONN);

        expect(res.ok).toBe(true);
        expect(approver).not.toHaveBeenCalled();
    });
});
