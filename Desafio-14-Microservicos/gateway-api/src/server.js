const { createApp } = require('./app');
const { log } = require('./logger');

const port = Number(process.env.PORT || 3000);
const app = createApp({
  userServiceUrl: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  catalogServiceUrl: process.env.CATALOG_SERVICE_URL || 'http://localhost:3002',
  timeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 2000),
  breaker: {
    failureThreshold: Number(process.env.BREAKER_FAILURE_THRESHOLD || 3),
    resetMs: Number(process.env.BREAKER_RESET_MS || 10000),
  },
});
app.listen(port, () => log('info', 'servico iniciado', { port }));
