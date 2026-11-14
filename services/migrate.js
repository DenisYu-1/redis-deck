const fs = require('fs');

// See docs/adr/0004-versioned-sqlite-migrations.md. WAL is not used, so the main file is the whole backup.
function migrate(db, migrations) {
    const current = db.pragma('user_version', { simple: true });
    if (current > migrations.length) {
        throw new Error(
            `The local database is at data version ${current}, but this app only knows up to ${migrations.length}. Update the app to open it.`
        );
    }
    if (current === migrations.length) return;

    const backup = `${db.name}.bak-v${current}`;
    const hasData = fs.statSync(db.name).size > 0;
    if (hasData) fs.copyFileSync(db.name, backup);

    for (let version = current + 1; version <= migrations.length; version++) {
        try {
            db.transaction(() => {
                migrations[version - 1](db);
                db.pragma(`user_version = ${version}`);
            })();
        } catch (error) {
            const backupNote = hasData
                ? ` Your data is backed up at ${backup}.`
                : '';
            throw new Error(
                `Upgrading the local database to data version ${version} failed: ${error.message.replace(/\.$/, '')}.${backupNote}`
            );
        }
    }
}

module.exports = { migrate };
