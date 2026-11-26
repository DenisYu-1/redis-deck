/** @jest-environment node */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { findAgent, searchPath } = require('../../services/ai/agentLookup');

describe('agent CLI lookup', () => {
    let home;
    let system;

    // A fake binary in the temp home.
    function install(dir, { mode = 0o755 } = {}) {
        const file = path.join(home, dir, 'claude');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, '#!/bin/sh\n', { mode });
        return file;
    }
    // This machine's own /opt/homebrew/bin and /usr/local/bin stay out.
    const find = (options) =>
        findAgent('claude', {
            home,
            env: { PATH: '' },
            systemDirs: [system],
            ...options
        });

    beforeEach(() => {
        home = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-home-'));
        system = path.join(home, 'system-bin');
    });
    afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

    it('finds nothing on a bare machine', () => {
        expect(find()).toBeNull();
    });

    it.each(['.local/bin', '.npm-global/bin', 'system-bin'])(
        'finds a binary in %s, which a Finder-launched app has not on PATH',
        (dir) => {
            const file = install(dir);
            expect(find()).toBe(file);
        }
    );

    it('searches PATH first', () => {
        install('.local/bin');
        const onPath = install('tools');
        expect(find({ env: { PATH: path.dirname(onPath) } })).toBe(onPath);
    });

    it('searches /opt/homebrew/bin and /usr/local/bin by default', () => {
        expect(searchPath({ home, env: { PATH: '/a' } })).toEqual([
            '/a',
            path.join(home, '.local/bin'),
            '/opt/homebrew/bin',
            '/usr/local/bin',
            path.join(home, '.npm-global/bin')
        ]);
    });

    it('skips a file that cannot be executed, and a folder', () => {
        install('.local/bin', { mode: 0o644 });
        fs.mkdirSync(path.join(home, '.npm-global/bin/claude'), {
            recursive: true
        });
        expect(find()).toBeNull();
    });

    it('takes the path field over the search, and only if it works', () => {
        install('.local/bin');
        const own = install('own');

        expect(find({ path: own })).toBe(own);
        expect(find({ path: path.join(home, 'gone/claude') })).toBeNull();
    });

    it('takes no path field naming another program', () => {
        expect(find({ path: '/bin/sh' })).toBeNull();
    });
});
