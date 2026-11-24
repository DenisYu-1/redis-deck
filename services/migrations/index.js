// Ordered migrations: entry N upgrades the database to data version N.
// Add a schema change by appending one new numbered module; never edit old ones.
module.exports = [
    require('./001-initial-schema'),
    require('./002-ai-activity')
];
