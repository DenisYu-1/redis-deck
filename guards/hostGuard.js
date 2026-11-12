// DNS-rebinding defence for the embedded (Electron) server: only answer requests
// whose Host header is 127.0.0.1:<port> or localhost:<port>.
function hostGuard(getPort) {
    return (req, res, next) => {
        const port = getPort();
        const allowed = [`127.0.0.1:${port}`, `localhost:${port}`];
        if (allowed.includes(String(req.headers.host || '').toLowerCase())) {
            return next();
        }
        res.status(403).json({ error: 'Forbidden: invalid Host header' });
    };
}

module.exports = { hostGuard };
