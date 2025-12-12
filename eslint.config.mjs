import prettier from 'eslint-plugin-prettier';

export default [
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                console: 'readonly',
                process: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
                window: 'readonly',
                document: 'readonly',
                fetch: 'readonly',
                localStorage: 'readonly',
                alert: 'readonly',
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly'
            }
        },
        plugins: {
            prettier: prettier
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-console': ['warn', { allow: ['error'] }],
            'prettier/prettier': 'error'
        }
    },
    {
        files: ['server.js', 'routes/**/*.js', 'services/**/*.js'],
        rules: {
            'no-console': 'off'
        }
    }
];
