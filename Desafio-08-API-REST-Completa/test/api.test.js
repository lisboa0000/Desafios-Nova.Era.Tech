const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openDb } = require('../src/db');
const { createApp, seedAdmin } = require('../src/app');

let server, base, admin, student;
const call = async (method, path, { body, token } = {}) => {
  const r = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
};

before(async () => {
  const db = openDb();
  seedAdmin(db, 'admin@test.com', 'admin123');
  server = createApp({ db, jwtSecret: 'segredo-de-teste' }).listen(0);
  base = `http://localhost:${server.address().port}`;
  admin = (await call('POST', '/auth/login', { body: { email: 'admin@test.com', password: 'admin123' } })).body.token;
  await call('POST', '/auth/register', { body: { name: 'Ana', email: 'ana@test.com', password: '123456' } });
  student = (await call('POST', '/auth/login', { body: { email: 'ana@test.com', password: '123456' } })).body.token;
});
after(() => server.close());

test('auth: validação, duplicidade e credenciais', async () => {
  const bad = await call('POST', '/auth/register', { body: { name: 'A', email: 'x', password: '1' } });
  assert.strictEqual(bad.status, 400);
  assert.strictEqual(bad.body.error.code, 'VALIDATION_ERROR');
  assert.ok(bad.body.error.details.length >= 3);
  assert.strictEqual((await call('POST', '/auth/register', { body: { name: 'Ana', email: 'ana@test.com', password: '123456' } })).status, 409);
  assert.strictEqual((await call('POST', '/auth/login', { body: { email: 'ana@test.com', password: 'errada' } })).status, 401);
});

test('rotas protegidas e permissões', async () => {
  const course = { title: 'Node.js', category: 'Backend', level: 'beginner' };
  const noToken = await call('POST', '/courses', { body: course });
  assert.strictEqual(noToken.status, 401);
  assert.strictEqual(noToken.body.error.code, 'UNAUTHORIZED');
  assert.strictEqual((await call('POST', '/courses', { body: course, token: 'lixo' })).status, 401);
  const forbidden = await call('POST', '/courses', { body: course, token: student });
  assert.strictEqual(forbidden.status, 403);
  assert.strictEqual(forbidden.body.error.code, 'FORBIDDEN');
  assert.strictEqual((await call('GET', '/me/enrollments')).status, 401);
});

test('CRUD de cursos', async () => {
  assert.strictEqual((await call('POST', '/courses', { token: admin, body: { title: 'ab', category: 'x', level: 'expert' } })).status, 400);
  const created = await call('POST', '/courses', { token: admin, body: { title: 'Docker', category: 'DevOps', level: 'intermediate' } });
  assert.strictEqual(created.status, 201);
  assert.strictEqual(created.body.category, 'devops');
  const id = created.body.id;
  assert.strictEqual((await call('GET', `/courses/${id}`)).body.title, 'Docker');
  const upd = await call('PUT', `/courses/${id}`, { token: admin, body: { title: 'Docker Avançado', category: 'devops', level: 'advanced' } });
  assert.strictEqual(upd.body.level, 'advanced');
  assert.strictEqual((await call('DELETE', `/courses/${id}`, { token: admin })).status, 204);
  assert.strictEqual((await call('GET', `/courses/${id}`)).status, 404);
  assert.strictEqual((await call('GET', '/courses/abc')).status, 400);
});

test('listagem paginada com filtros', async () => {
  for (let i = 1; i <= 12; i++) {
    await call('POST', '/courses', { token: admin, body: { title: `Curso ${i}`, category: i % 2 ? 'data' : 'web', level: i <= 4 ? 'advanced' : 'beginner' } });
  }
  const p1 = (await call('GET', '/courses?category=data&limit=4')).body;
  assert.strictEqual(p1.data.length, 4);
  assert.deepStrictEqual(p1.meta, { page: 1, limit: 4, total: 6, totalPages: 2 });
  assert.strictEqual((await call('GET', '/courses?category=data&limit=4&page=2')).body.data.length, 2);
  const adv = (await call('GET', '/courses?level=advanced&category=web')).body;
  assert.strictEqual(adv.meta.total, 2);
  assert.ok(adv.data.every((c) => c.level === 'advanced' && c.category === 'web'));
  assert.strictEqual((await call('GET', '/courses?q=Curso 12')).body.meta.total, 1);
  assert.strictEqual((await call('GET', '/courses?limit=1000')).status, 400);
  assert.strictEqual((await call('GET', '/courses?level=xyz')).status, 400);
});

test('matrículas', async () => {
  const id = (await call('GET', '/courses?limit=1')).body.data[0].id;
  assert.strictEqual((await call('POST', `/courses/${id}/enrollments`, { token: student })).status, 201);
  assert.strictEqual((await call('POST', `/courses/${id}/enrollments`, { token: student })).status, 409);
  assert.strictEqual((await call('POST', '/courses/99999/enrollments', { token: student })).status, 404);
  assert.strictEqual((await call('GET', '/me/enrollments', { token: student })).body.length, 1);
  assert.strictEqual((await call('GET', `/courses/${id}/enrollments`, { token: student })).status, 403);
  assert.strictEqual((await call('GET', `/courses/${id}/enrollments`, { token: admin })).body[0].email, 'ana@test.com');
  assert.strictEqual((await call('DELETE', `/courses/${id}/enrollments`, { token: student })).status, 204);
  assert.strictEqual((await call('DELETE', `/courses/${id}/enrollments`, { token: student })).status, 404);
});

test('erros padronizados: rota inexistente e JSON inválido', async () => {
  const r = await fetch(`${base}/nada`);
  assert.strictEqual(r.status, 404);
  assert.strictEqual((await r.json()).error.code, 'ROUTE_NOT_FOUND');
  const bad = await fetch(`${base}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{x' });
  assert.strictEqual((await bad.json()).error.code, 'INVALID_JSON');
  assert.ok((await (await fetch(`${base}/api/v1/openapi.json`)).json()).paths['/courses']);
});
