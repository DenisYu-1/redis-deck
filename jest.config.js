export default {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/__tests__', '<rootDir>/client'],
    testMatch: [
        '**/__tests__/**/*.test.ts',
        '**/__tests__/**/*.test.tsx',
        '**/*.test.ts',
        '**/*.test.tsx'
    ],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/client/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
    },
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: {
                    jsx: 'react-jsx',
                    esModuleInterop: true,
                    allowSyntheticDefaultImports: true
                }
            }
        ]
    },
    setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
    collectCoverageFrom: [
        'client/**/*.{ts,tsx}',
        '!client/**/*.d.ts',
        '!client/vite-env.d.ts',
        '!client/**/*.test.{ts,tsx}'
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json']
};
