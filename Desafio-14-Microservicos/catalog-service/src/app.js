const express = require('express');
const repository = require('./repository');
const { requestLogger, SERVICE_NAME } = require('./logger');

function createApp() {
  const app = express();
  app.use(requestLogger);

  app.get('/health', (req, res) => res.json({ status: 'ok', service: SERVICE_NAME }));

  app.get('/products', (req, res) => {
    if (req.query.ids !== undefined) {
      const ids = String(req.query.ids)
        .split(',')
        .filter((v) => v !== '')
        .map(Number);
      if (ids.some((n) => !Number.isInteger(n))) {
        return res.status(400).json({ error: 'INVALID_IDS', message: 'ids deve ser uma lista numerica separada por virgula' });
      }
      return res.json(repository.findByIds(ids));
    }
    res.json(repository.findAll());
  });

  app.get('/products/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'INVALID_ID', message: 'id deve ser numerico' });
    const product = repository.findById(id);
    if (!product) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND', message: `Produto ${id} nao encontrado` });
    res.json(product);
  });

  return app;
}

module.exports = { createApp };
