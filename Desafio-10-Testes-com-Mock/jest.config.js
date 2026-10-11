module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: { branches: 85, functions: 90, lines: 90, statements: 90 }
  }
}
