const SERVICE_NAME = process.env.SERVICE_NAME || 'gateway-api';

function log(level, message, extra = {}) {
  const line = { time: new Date().toISOString(), service: SERVICE_NAME, level, message, ...extra };
  const out = level === 'error' ? console.error : console.log;
  out(JSON.stringify(line));
}

function requestLogger(req, res, next) {
  const start = Date.now();
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  res.on('finish', () => {
    log('info', 'request', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
}

module.exports = { log, requestLogger, SERVICE_NAME };
