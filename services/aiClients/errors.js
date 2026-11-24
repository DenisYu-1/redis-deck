// Installer failure with an HTTP status for the routes (404 unknown AI client,
// 409 config file we refuse to rewrite).
class InstallerError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

module.exports = { InstallerError };
