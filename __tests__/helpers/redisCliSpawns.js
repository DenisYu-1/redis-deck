// Count redis-cli processes spawned by the backend (services/redis.js calls
// childProcess.execFile at call time, so a spy here sees every spawn).
// `remap` rewrites `-h host -p port` pairs, e.g. to reach cluster Nodes that
// announce Docker-internal addresses: { 'redis-node-2:6379': '127.0.0.1:53792' }.
const childProcess = require('child_process');

const CLI = process.env.REDIS_CLI_PATH || 'redis-cli';

function rewrite(args, remap) {
    const h = args.indexOf('-h');
    const p = args.indexOf('-p');
    const target = h >= 0 && p >= 0 && remap[`${args[h + 1]}:${args[p + 1]}`];
    if (!target) {
        return args;
    }
    const [host, port] = target.split(':');
    const out = [...args];
    out[h + 1] = host;
    out[p + 1] = port;
    return out;
}

function countRedisCliSpawns({ remap = {} } = {}) {
    const real = childProcess.execFile;
    const spawns = [];
    let inFlight = 0;
    let peak = 0;
    const spy = jest
        .spyOn(childProcess, 'execFile')
        .mockImplementation((file, args, ...rest) => {
            if (file !== CLI) {
                return real.call(childProcess, file, args, ...rest);
            }
            spawns.push(args);
            // Track processes running at once (released in the exit callback).
            const cb = rest[rest.length - 1];
            if (typeof cb === 'function') {
                inFlight++;
                peak = Math.max(peak, inFlight);
                rest[rest.length - 1] = (...result) => {
                    inFlight--;
                    cb(...result);
                };
            }
            return real.call(childProcess, file, rewrite(args, remap), ...rest);
        });
    return {
        get count() {
            return spawns.length;
        },
        // Most redis-cli processes running at once since the last reset.
        get peak() {
            return peak;
        },
        spawns,
        reset: () => {
            spawns.splice(0);
            peak = inFlight;
        },
        restore: () => spy.mockRestore()
    };
}

module.exports = { countRedisCliSpawns };
