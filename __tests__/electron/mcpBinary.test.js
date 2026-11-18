const { mcpBinary } = require('../../electron/mcpBinary');

describe('mcpBinary', () => {
    it('packaged: the app executable + --mcp', () => {
        expect(
            mcpBinary({
                packaged: true,
                execPath:
                    '/Applications/Redis Deck.app/Contents/MacOS/Redis Deck',
                appPath: '/ignored'
            })
        ).toEqual({
            command: '/Applications/Redis Deck.app/Contents/MacOS/Redis Deck',
            args: ['--mcp']
        });
    });

    it('electron:dev: the dev Electron binary + repo path + --mcp', () => {
        expect(
            mcpBinary({
                packaged: false,
                execPath: '/repo/node_modules/electron/dist/Electron',
                appPath: '/repo'
            })
        ).toEqual({
            command: '/repo/node_modules/electron/dist/Electron',
            args: ['/repo', '--mcp']
        });
    });
});
