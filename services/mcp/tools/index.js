// Every MCP tool the server registers, in registry order.
module.exports = [
    ...require('./read'),
    ...require('./write'),
    ...require('./workflows')
];
