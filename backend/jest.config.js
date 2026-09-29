module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'routes/**/*.js',
    'services/**/*.js',
    '!node_modules/**'
  ],
  testTimeout: 10000,
  verbose: true,
  transformIgnorePatterns: [
    'node_modules/(?!(axios-cookiejar-support|http-cookie-agent)/)'
  ]
};
