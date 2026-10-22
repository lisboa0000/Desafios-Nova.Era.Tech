const express = require('express');
const repository = require('./repository');
const { requestLogger, SERVICE_NAME } = require('./logger');

function createApp() {
  const app = express();
  app.use(requestLogger);

  app.get('/health', (req, res) => res.json({ status: 'ok', service: SERVICE_NAME }));

  app.get('/users', (req, res) => res.json(repository.findAll()));

  app.get('/users/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'INVALID_ID', message: 'id deve ser numerico' });
    const user = repository.findById(id);
    if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND', message: `Usuario ${id} nao encontrado` });
    res.json(user);
  });

  return app;
}

module.exports = { createApp };
