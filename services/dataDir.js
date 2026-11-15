const path = require('path');

// The app's data folder (SQLite file, External Plugins); DATA_DIR overrides.
function getDataDir() {
    return process.env.DATA_DIR || path.join(__dirname, '..', 'data');
}

module.exports = { getDataDir };
