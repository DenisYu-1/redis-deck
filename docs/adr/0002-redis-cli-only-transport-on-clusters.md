# redis-cli is the only transport on clustered Connections

On a clustered Connection every Redis call goes through `redis-cli`. The persistent node-redis client (`services/redisClient.js`) stays limited to non-clustered Connections.

RedisDeck exists because client libraries were unreliable on clusters: they failed on Node addresses (advertised addresses not reachable from the app, e.g. Docker) and on MOVED redirects, while `redis-cli` worked. Alternative considered: `createCluster` from node-redis with `nodeAddressMap`. It would remove process-spawn cost but reintroduces the failure modes the tool was built to avoid.

Consequences: cluster performance work must cut `redis-cli` spawns (batch commands per Node through one stdin session, scan Nodes in parallel, cache topology) rather than change transport. Reversing this means re-validating every cluster topology the tool is used against.
