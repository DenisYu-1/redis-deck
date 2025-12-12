module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.js'],
    collectCoverageFrom: [
        'services/**/*.js',
        'routes/**/*.js',
        '!node_modules/**'
    ],
    coverageDirectory: 'coverage',
    testTimeout: 30000,
    setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
    maxWorkers: 1
};
