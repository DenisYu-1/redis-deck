/** @jest-environment node */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createInstaller } = require('../../services/aiClients/installer');

const BINARY = { command: '/Applications/Redis Deck.app/x', args: ['--mcp'] };

describe('AI client installer: Claude Code', () => {
    let home;
    let file;
    const installer = (binary = BINARY) => createInstaller({ home, ...binary });
    const readJson = () => JSON.parse(fs.readFileSync(file, 'utf8'));

    beforeEach(() => {
        home = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-home-'));
        file = path.join(home, '.claude.json');
    });
    afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

    it('creates ~/.claude.json with the redis-deck entry when missing', () => {
        installer().install('claude-code');

        expect(readJson()).toEqual({
            mcpServers: {
                'redis-deck': {
                    type: 'stdio',
                    command: '/Applications/Redis Deck.app/x',
                    args: ['--mcp']
                }
            }
        });
    });

    it('keeps unrelated content and other MCP servers on install', () => {
        const existing = {
            numStartups: 42,
            projects: { '/x': { allowedTools: ['Bash'] } },
            mcpServers: { other: { command: 'other-bin', args: [] } }
        };
        fs.writeFileSync(file, JSON.stringify(existing));

        installer().install('claude-code');

        const doc = readJson();
        expect(doc.numStartups).toBe(42);
        expect(doc.projects).toEqual(existing.projects);
        expect(doc.mcpServers.other).toEqual(existing.mcpServers.other);
        expect(doc.mcpServers['redis-deck'].command).toBe(BINARY.command);
    });

    it('reports Not installed, Installed and Stale', () => {
        expect(installer().status('claude-code')).toBe('not-installed');

        installer().install('claude-code');
        expect(installer().status('claude-code')).toBe('installed');

        const moved = {
            command: '/Users/me/Apps/Redis Deck.app/x',
            args: ['--mcp']
        };
        expect(installer(moved).status('claude-code')).toBe('stale');
        expect(
            installer({ ...BINARY, args: ['/repo', '--mcp'] }).status(
                'claude-code'
            )
        ).toBe('stale');
    });

    it('Reinstall fixes a Stale entry', () => {
        installer({ command: '/old/path', args: ['--mcp'] }).install(
            'claude-code'
        );
        expect(installer().status('claude-code')).toBe('stale');

        installer().install('claude-code');

        expect(installer().status('claude-code')).toBe('installed');
        expect(readJson().mcpServers['redis-deck'].command).toBe(
            BINARY.command
        );
    });

    it('Remove deletes only the redis-deck entry', () => {
        fs.writeFileSync(
            file,
            JSON.stringify({
                theme: 'dark',
                mcpServers: { other: { command: 'other-bin' } }
            })
        );
        installer().install('claude-code');

        installer().remove('claude-code');

        expect(readJson()).toEqual({
            theme: 'dark',
            mcpServers: { other: { command: 'other-bin' } }
        });
        expect(installer().status('claude-code')).toBe('not-installed');
    });

    it('Remove on a missing file creates nothing', () => {
        installer().remove('claude-code');
        expect(fs.existsSync(file)).toBe(false);
    });

    it('refuses to overwrite a file that is not valid JSON', () => {
        fs.writeFileSync(file, '{ broken');

        expect(() => installer().install('claude-code')).toThrow(
            /not valid JSON/
        );
        expect(fs.readFileSync(file, 'utf8')).toBe('{ broken');
        expect(
            installer()
                .list()
                .find((row) => row.id === 'claude-code')
        ).toMatchObject({
            id: 'claude-code',
            status: 'error'
        });
    });

    it('snippet gives the config path and the entry to paste', () => {
        const { path: where, text } = installer().snippet('claude-code');

        expect(where).toBe(file);
        expect(JSON.parse(text)).toEqual({
            mcpServers: {
                'redis-deck': {
                    type: 'stdio',
                    command: '/Applications/Redis Deck.app/x',
                    args: ['--mcp']
                }
            }
        });
    });

    it('lists each AI client with its status', () => {
        installer().install('claude-code');

        expect(installer().list()).toContainEqual({
            id: 'claude-code',
            name: 'Claude Code',
            configPath: file,
            status: 'installed'
        });
    });

    it('rejects an unknown AI client', () => {
        expect(() => installer().install('nope')).toThrow(/Unknown AI client/);
    });
});

describe.each([
    {
        id: 'claude-desktop',
        name: 'Claude Desktop',
        rel: [
            'Library',
            'Application Support',
            'Claude',
            'claude_desktop_config.json'
        ]
    },
    { id: 'cursor', name: 'Cursor', rel: ['.cursor', 'mcp.json'] }
])('AI client installer: $name', ({ id, name, rel }) => {
    let home;
    let file;
    const installer = (binary = BINARY) => createInstaller({ home, ...binary });
    const readJson = () => JSON.parse(fs.readFileSync(file, 'utf8'));

    beforeEach(() => {
        home = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-home-'));
        file = path.join(home, ...rel);
    });
    afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

    it('creates the config file and its folders when missing', () => {
        installer().install(id);

        expect(readJson()).toEqual({
            mcpServers: {
                'redis-deck': {
                    command: '/Applications/Redis Deck.app/x',
                    args: ['--mcp']
                }
            }
        });
    });

    it('keeps unrelated content and other MCP servers on install', () => {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const existing = {
            globalShortcut: 'Cmd+K',
            mcpServers: { other: { command: 'other-bin', args: ['-x'] } }
        };
        fs.writeFileSync(file, JSON.stringify(existing));

        installer().install(id);

        const doc = readJson();
        expect(doc.globalShortcut).toBe('Cmd+K');
        expect(doc.mcpServers.other).toEqual(existing.mcpServers.other);
        expect(doc.mcpServers['redis-deck'].command).toBe(BINARY.command);
    });

    it('reports Not installed, Installed and Stale; Reinstall fixes Stale', () => {
        expect(installer().status(id)).toBe('not-installed');

        installer({ command: '/old/path', args: ['--mcp'] }).install(id);
        expect(installer().status(id)).toBe('stale');

        installer().install(id);
        expect(installer().status(id)).toBe('installed');
        expect(installer().list()).toContainEqual({
            id,
            name,
            configPath: file,
            status: 'installed'
        });
    });

    it('Remove deletes only the redis-deck entry', () => {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
            file,
            JSON.stringify({ mcpServers: { other: { command: 'o' } } })
        );
        installer().install(id);

        installer().remove(id);

        expect(readJson()).toEqual({ mcpServers: { other: { command: 'o' } } });
        expect(installer().status(id)).toBe('not-installed');
    });
});

describe('AI client installer: Codex', () => {
    let home;
    let file;
    const installer = (binary = BINARY) => createInstaller({ home, ...binary });
    const read = () => fs.readFileSync(file, 'utf8');
    const BLOCK =
        '[mcp_servers.redis-deck]\n' +
        'command = "/Applications/Redis Deck.app/x"\n' +
        'args = ["--mcp"]\n';

    beforeEach(() => {
        home = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-home-'));
        file = path.join(home, '.codex', 'config.toml');
    });
    afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

    it('creates ~/.codex/config.toml with the redis-deck block when missing', () => {
        installer().install('codex');

        expect(read()).toBe(BLOCK);
    });

    const EXISTING =
        '# my codex settings\r\n' +
        'model = "o3"  # pinned\n' +
        '\n' +
        '[mcp_servers.other]\n' +
        "command = 'other-bin'\n" +
        'args = [ "-x",\n' +
        '  "-y" ]\n';
    const writeExisting = (text) => {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, text);
    };

    it('appends the block and keeps existing lines byte-for-byte', () => {
        writeExisting(EXISTING);

        installer().install('codex');

        expect(read()).toBe(EXISTING + '\n' + BLOCK);
    });

    it('appends after a last line without a newline', () => {
        writeExisting('model = "o3"');

        installer().install('codex');

        expect(read()).toBe('model = "o3"\n\n' + BLOCK);
    });

    it('reports Not installed, Installed and Stale', () => {
        writeExisting(EXISTING);
        expect(installer().status('codex')).toBe('not-installed');

        installer().install('codex');
        expect(installer().status('codex')).toBe('installed');

        expect(
            installer({ command: '/moved/x', args: ['--mcp'] }).status('codex')
        ).toBe('stale');
        expect(
            installer({ ...BINARY, args: ['/repo', '--mcp'] }).status('codex')
        ).toBe('stale');
    });

    it('reads a hand-written block with literal strings and multi-line args', () => {
        writeExisting(
            '[mcp_servers."redis-deck"]\n' +
                "command = '/Applications/Redis Deck.app/x'  # app\n" +
                'args = [\n' +
                '  "--mcp", # flag\n' +
                ']\n'
        );

        expect(installer().status('codex')).toBe('installed');
    });

    it('Reinstall replaces only the redis-deck block', () => {
        const before = '# top\r\nmodel = "o3"\n\n';
        const after = '\n[mcp_servers.other]\ncommand = "o"\n';
        writeExisting(
            before +
                '[mcp_servers.redis-deck]\n' +
                'command = "/old/path"\n' +
                'args = ["--mcp"]\n' +
                'env = { A = "1" }\n' +
                after
        );
        expect(installer().status('codex')).toBe('stale');

        installer().install('codex');

        expect(read()).toBe(before + BLOCK + after);
        expect(installer().status('codex')).toBe('installed');
    });

    it('Remove after install gives back the original file', () => {
        writeExisting(EXISTING);
        installer().install('codex');

        installer().remove('codex');

        expect(read()).toBe(EXISTING);
        expect(installer().status('codex')).toBe('not-installed');
    });

    it('Remove deletes only the redis-deck block and its sub-tables', () => {
        const before = 'model = "o3"\n\n';
        const after = '\n[mcp_servers.other]\ncommand = "o"\n';
        writeExisting(
            before + BLOCK + '\n[mcp_servers.redis-deck.env]\nA = "1"\n' + after
        );

        installer().remove('codex');

        expect(read()).toBe(before + after.slice(1));
    });

    it('Remove with no block leaves the file untouched', () => {
        writeExisting(EXISTING);
        const mtime = fs.statSync(file).mtimeMs;

        installer().remove('codex');

        expect(read()).toBe(EXISTING);
        expect(fs.statSync(file).mtimeMs).toBe(mtime);
    });

    it.each([
        '[mcp_servers]\nredis-deck = { command = "x" }\n',
        'mcp_servers.redis-deck.command = "x"\n'
    ])('refuses a redis-deck entry it cannot rewrite: %j', (text) => {
        writeExisting(text);

        expect(() => installer().install('codex')).toThrow(/cannot rewrite/);
        expect(read()).toBe(text);
    });

    it('snippet gives the config path and the block to paste', () => {
        expect(installer().snippet('codex')).toEqual({
            path: file,
            text: BLOCK
        });
    });

    it('escapes quotes and backslashes in the binary path', () => {
        const odd = { command: 'C:\\a "b"\\x', args: ['--mcp'] };
        installer(odd).install('codex');

        expect(read()).toContain('command = "C:\\\\a \\"b\\"\\\\x"');
        expect(installer(odd).status('codex')).toBe('installed');
    });
});
