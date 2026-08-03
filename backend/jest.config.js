export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  testTimeout: 60000,
  coverageThreshold: {
    './src/utils/cronJobs.js': {
      branches: 50,
      functions: 50,
      lines: 70,
      statements: 70
    },
    './src/utils/plannerLogic.js': {
      branches: 60,
      functions: 90,
      lines: 80,
      statements: 80
    },
    './src/utils/rebalanceHelper.js': {
      branches: 60,
      functions: 80,
      lines: 70,
      statements: 70
    },
    './src/models/NotificationDelivery.js': {
      branches: 40,
      functions: 80,
      lines: 70,
      statements: 70
    },
    './src/services/tokenService.js': {
      branches: 50,
      functions: 100,
      lines: 90,
      statements: 90
    }
  }
};
