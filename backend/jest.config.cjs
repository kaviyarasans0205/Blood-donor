/** Jest config for backend tests (ESM, native imports, in-memory MongoDB). */
/** @type {import('jest').Config} */
module.exports = {
  rootDir: '..',
  roots: ['<rootDir>/tests/backend'],
  testMatch: ['**/*.test.js'],
  // Test files live in tests/ (type: module); backend sources resolve deps
  // from backend/node_modules, test files resolve from the same place.
  modulePaths: ['<rootDir>/backend/node_modules'],
  testEnvironment: 'node',
  transform: {},
  testTimeout: 120000,
  verbose: true,
  forceExit: true,
};
