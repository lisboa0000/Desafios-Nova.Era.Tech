const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createApp } = require('../src/app');

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function fakeUserService() {
  const app = express();
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/users/:id', (req, res) => {
    if (req.params.id === '1') return res.json({ id: 1, name: 'Ana', email: 'ana@example.com', favoriteProductIds: [1, 3] });
    res.status(404).json({ error: 'USER_NOT_FOUND', message: 'nao encontrado' });
  });
  return app;
}

function fakeCatalogService() {
  const app = express();
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/products', (req, res) => res.json([
    { id: 1, name: 'Teclado' },
    { id: 3, name: 'Mouse' },
  ]));
  return app;
}

let userServer;
let catalogServer;
let gatewayServer;
let gatewayUrl;

const urlOf = (server) => `http://127.0.0.1:${server.address().port}`;

before(async () => {
  userServer = await listen(fakeUserService());
  catalogServer = await listen(fakeCatalogService());
  gatewayServer = await listen(createApp({
    userServiceUrl: urlOf(userServer),
    catalogServiceUrl: urlOf(catalogServer),
    timeoutMs: 500,
    breaker: { failureThreshold: 2, resetMs: 60000 },
  }));
  gatewayUrl = urlOf(gatewayServer);
});

after(() => {
  gatewayServer.close();
  userServer.close();
  catalogServer.close();
});

test('overview compoe dados do usuario e do catalogo', async () => {
  const res = await fetch(`${gatewayUrl}/users/1/overview`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.user.name, 'Ana');
  assert.equal(body.favorites.length, 2);
  assert.equal(body.degraded, false);
});

test('usuario inexistente repassa 404 do user-service', async () => {
  const res = await fetch(`${gatewayUrl}/users/99/overview`);
  assert.equal(res.status, 404);
});

test('propaga o x-request-id', async () => {
  const res = await fetch(`${gatewayUrl}/products`, { headers: { 'x-request-id': 'abc-123' } });
  assert.equal(res.headers.get('x-request-id'), 'abc-123');
});

test('catalogo fora do ar gera resposta parcial, nao erro', async () => {
  catalogServer.close();
  const res = await fetch(`${gatewayUrl}/users/1/overview`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.degraded, true);
  assert.equal(body.favorites, null);
  assert.equal(body.user.name, 'Ana');
});

test('circuit breaker abre apos falhas consecutivas', async () => {
  await fetch(`${gatewayUrl}/users/1/overview`);
  const health = await (await fetch(`${gatewayUrl}/health`)).json();
  assert.equal(health.status, 'degraded');
  assert.equal(health.dependencies['catalog-service'], 'down');
  assert.equal(health.circuits['catalog-service'], 'open');
  assert.equal(health.dependencies['user-service'], 'up');
});

test('user-service fora do ar retorna 503 tratado', async () => {
  userServer.close();
  const res = await fetch(`${gatewayUrl}/users/1/overview`);
  const body = await res.json();
  assert.equal(res.status, 503);
  assert.equal(body.error, 'SERVICE_UNAVAILABLE');
  assert.equal(body.service, 'user-service');
});
