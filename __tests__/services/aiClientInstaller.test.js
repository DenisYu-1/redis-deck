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
        expect(installer().list()[0]).toMatchObject({
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
