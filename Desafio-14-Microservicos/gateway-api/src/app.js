const express = require('express');
const { ServiceClient, UpstreamError } = require('./serviceClient');
const { requestLogger, log, SERVICE_NAME } = require('./logger');

function createApp({ userServiceUrl, catalogServiceUrl, timeoutMs = 2000, breaker } = {}) {
  const users = new ServiceClient({ name: 'user-service', baseUrl: userServiceUrl, timeoutMs, breaker });
  const catalog = new ServiceClient({ name: 'catalog-service', baseUrl: catalogServiceUrl, timeoutMs, breaker });

  const app = express();
  app.use(requestLogger);

  app.get('/health', async (req, res) => {
    const check = async (client) => {
      try {
        await client.get('/health', { requestId: req.id });
        return 'up';
      } catch {
        return 'down';
      }
    };
    const [userStatus, catalogStatus] = await Promise.all([check(users), check(catalog)]);
    const allUp = userStatus === 'up' && catalogStatus === 'up';
    res.json({
      status: allUp ? 'ok' : 'degraded',
      service: SERVICE_NAME,
      dependencies: { 'user-service': userStatus, 'catalog-service': catalogStatus },
      circuits: { 'user-service': users.breaker.state, 'catalog-service': catalog.breaker.state },
    });
  });

  app.get('/products', async (req, res, next) => {
    try {
      res.json(await catalog.get('/products', { requestId: req.id }));
    } catch (err) {
      next(err);
    }
  });

  app.get('/users/:id/overview', async (req, res, next) => {
    try {
      const user = await users.get(`/users/${encodeURIComponent(req.params.id)}`, { requestId: req.id });

      let favorites = [];
      let degraded = false;
      if (user.favoriteProductIds.length > 0) {
        try {
          favorites = await catalog.get(`/products?ids=${user.favoriteProductIds.join(',')}`, { requestId: req.id });
        } catch (err) {
          log('warn', 'catalogo indisponivel, resposta parcial', { requestId: req.id, reason: err.message });
          favorites = null;
          degraded = true;
        }
      }

      const response = {
        user: { id: user.id, name: user.name, email: user.email },
        favorites,
        degraded,
      };
      if (degraded) response.warning = 'catalog-service indisponivel: favoritos nao carregados';
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  app.use((err, req, res, next) => {
    if (err instanceof UpstreamError) {
      if (err.status && err.status < 500) return res.status(err.status).json(err.body);
      return res.status(503).json({ error: 'SERVICE_UNAVAILABLE', message: err.message, service: err.service });
    }
    log('error', 'erro nao tratado', { requestId: req.id, reason: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'erro interno' });
  });

  return app;
}

module.exports = { createApp };
