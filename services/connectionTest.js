// Password for "test connection" on an unsaved/edited config. The stored
// password is only reused when the target host and port are the saved ones, so
// a request can never ship it to an arbitrary host.
function resolveTestPassword(connection, saved) {
    if (connection.password) {
        return connection.password;
    }
    if (
        saved &&
        connection.id &&
        saved.host === connection.host &&
        String(saved.port) === String(connection.port)
    ) {
        return saved.password;
    }
    return undefined;
}

module.exports = { resolveTestPassword };
