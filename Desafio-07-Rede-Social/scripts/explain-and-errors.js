// Gera a evidência de índices (explain) e dos erros de validação, com Mongo em memória.
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connect, getDb, close } = require('../src/db');
const app = require('../src/app');

(async () => {
  const mongo = await MongoMemoryServer.create();
  await connect(mongo.getUri(), 'rede_social');
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;
  const call = async (label, method, path, body) => {
    const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
    const j = await r.json();
    console.log(`${method} ${path.replace(/[0-9a-f]{24}/g, ':id')}  ${JSON.stringify(body ?? {})}\n  -> ${r.status}  ${JSON.stringify(j)}   # ${label}\n`);
    return j;
  };

  if (process.argv[2] === 'errors') {
    const u = await call('criado', 'POST', '/users', { name: 'Ana', username: 'ana' });
    await call('username duplicado', 'POST', '/users', { name: 'Ana', username: 'ana' });
    await call('campos obrigatórios ausentes', 'POST', '/users', {});
    await call('conteúdo vazio', 'POST', '/posts', { author: u._id, content: '' });
    await call('autor com id inválido', 'POST', '/posts', { author: '123', content: 'oi' });
    await call('autor inexistente', 'POST', '/posts', { author: 'a'.repeat(24), content: 'oi' });
    const p = await call('criado', 'POST', '/posts', { author: u._id, content: 'oi #mongo' });
    await call('comentário sem texto', 'POST', `/posts/${p._id}/comments`, { author: u._id });
    await call('post inexistente', 'POST', `/posts/${'b'.repeat(24)}/comments`, { author: u._id, text: 'x' });
  } else {
    const posts = getDb().collection('posts');
    const tags = ['mongodb', 'nodejs', 'backend', 'docker', 'sql', 'jest', 'api', 'nosql'];
    const docs = Array.from({ length: 20000 }, (_, i) => ({
      author: i % 50, content: `post ${i}`, hashtags: [tags[i % 8], tags[(i * 3 + 1) % 8]],
      comments: [], commentsCount: 0, likes: [], likesCount: 0, createdAt: new Date(Date.now() - i * 1000),
    }));
    await posts.insertMany(docs);
    console.log('Posts inseridos: 20000\n\nÍndices de posts:');
    (await posts.indexes()).forEach((i) => console.log('  ', i.name, JSON.stringify(i.key)));
    for (const [titulo, filtro] of [['Feed geral (sort createdAt desc, limit 10)', {}], ['Feed filtrado por hashtag "mongodb"', { hashtags: 'mongodb' }]]) {
      const ex = await posts.find(filtro).sort({ createdAt: -1 }).limit(10).explain('executionStats');
      const stages = [];
      for (let s = ex.queryPlanner.winningPlan; s; s = s.inputStage) stages.push(s.stage + (s.indexName ? `(${s.indexName})` : ''));
      const st = ex.executionStats;
      console.log(`\n${titulo}\n  plano: ${stages.join(' <- ')}\n  documentos examinados: ${st.totalDocsExamined} | chaves examinadas: ${st.totalKeysExamined} | retornados: ${st.nReturned} | ${st.executionTimeMillis} ms`);
    }
  }
  server.close(); await close(); await mongo.stop();
})();
