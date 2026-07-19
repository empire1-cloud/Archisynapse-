module.exports = {
  testEnvironment: 'node',
  testRunner: 'jest-circus/runner',
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/tests/**/*.test.js',
  ],
  coveragePathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: ['src/**/*.js'],
};
