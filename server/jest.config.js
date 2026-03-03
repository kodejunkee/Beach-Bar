/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/__tests__'],
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            { tsconfig: 'tsconfig.test.json' },
        ],
    },
};
