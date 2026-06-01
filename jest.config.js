module.exports = {
  testEnvironment: 'node',
  testRunner: 'jest-circus/runner',
  testMatch: ['**/__tests__/**/*.test.js'],
  coveragePathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: ['src/**/*.js']
};
