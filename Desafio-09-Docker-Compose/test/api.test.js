const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connect, close } = require('../src/db');
const app = require('../src/app');

let mongo, server, base;
const call = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};

before(async () => {
  mongo = await MongoMemoryServer.create();
  await connect(mongo.getUri(), 'test');
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
});
after(async () => { server.close(); await close(); await mongo.stop(); });

test('fluxo completo: usuário, post, comentário, curtida, feed e top hashtags', async () => {
  assert.strictEqual((await call('POST', '/users', { name: '' })).status, 400);
  const u = (await call('POST', '/users', { name: 'Ana', username: 'Ana_1' })).body;
  assert.strictEqual(u.username, 'ana_1');
  assert.strictEqual((await call('POST', '/users', { name: 'X', username: 'ana_1' })).status, 409);

  assert.strictEqual((await call('POST', '/posts', { author: u._id, content: '' })).status, 400);
  const p1 = (await call('POST', '/posts', { author: u._id, content: 'Olá #Mongo e #node', hashtags: ['extra'] })).body;
  assert.deepStrictEqual(p1.hashtags, ['mongo', 'node', 'extra']);
  await call('POST', '/posts', { author: u._id, content: 'segundo #node' });

  assert.strictEqual((await call('POST', `/posts/${p1._id}/comments`, { author: u._id })).status, 400);
  assert.strictEqual((await call('POST', `/posts/${p1._id}/comments`, { author: u._id, text: 'legal' })).status, 201);
  assert.strictEqual((await call('POST', `/posts/${'a'.repeat(24)}/comments`, { author: u._id, text: 'x' })).status, 404);
  await call('POST', `/posts/${p1._id}/likes`, { user: u._id });
  await call('POST', `/posts/${p1._id}/likes`, { user: u._id });

  const feed = (await call('GET', '/feed')).body.data;
  assert.strictEqual(feed.length, 2);
  assert.strictEqual(feed[0].content, 'segundo #node');
  assert.strictEqual(feed[1].commentsCount, 1);
  assert.strictEqual(feed[1].likesCount, 1);
  assert.strictEqual(feed[1].author.username, 'ana_1');

  assert.strictEqual((await call('GET', '/feed?hashtag=%23Mongo')).body.data.length, 1);
  assert.deepStrictEqual((await call('GET', '/hashtags/top')).body[0], { total: 2, hashtag: 'node' });
});
