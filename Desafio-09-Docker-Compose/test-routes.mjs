// Requer a API rodando (npm start ou node scripts/dev-memory.js).
const B = process.env.TEST_URL || `http://localhost:${process.env.PORT || 3000}`;
let fails = 0;
async function call(label, method, path, body, expect) {
  const r = await fetch(B + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => null);
  const ok = r.status === expect;
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} -> ${r.status} (esperado ${expect})`, ok ? '' : JSON.stringify(j));
  return j;
}
function check(label, cond) { if (!cond) fails++; console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}`); }

const s = Date.now().toString(36);
const ana = await call('criar usuário', 'POST', '/users', { name: 'Ana', username: `ana_${s}` }, 201);
const bia = await call('criar usuário 2', 'POST', '/users', { name: 'Bia', username: `bia_${s}` }, 201);
await call('username duplicado', 'POST', '/users', { name: 'Ana', username: `ana_${s}` }, 409);
await call('usuário sem username', 'POST', '/users', { name: 'Ana' }, 400);
const p1 = await call('criar post', 'POST', '/posts', { author: ana._id, content: 'Aprendendo #MongoDB e #nodejs', hashtags: ['backend'] }, 201);
check('hashtags normalizadas', JSON.stringify(p1.hashtags) === '["mongodb","nodejs","backend"]');
await call('criar post 2', 'POST', '/posts', { author: bia._id, content: 'Agregações são ótimas #mongodb' }, 201);
await call('post sem conteúdo', 'POST', '/posts', { author: ana._id, content: '  ' }, 400);
await call('post autor inexistente', 'POST', '/posts', { author: 'a'.repeat(24), content: 'x' }, 404);
await call('post autor inválido', 'POST', '/posts', { author: '123', content: 'x' }, 400);
await call('comentar', 'POST', `/posts/${p1._id}/comments`, { author: bia._id, text: 'Muito bom!' }, 201);
await call('comentar 2', 'POST', `/posts/${p1._id}/comments`, { author: ana._id, text: 'Obrigada' }, 201);
await call('comentário sem texto', 'POST', `/posts/${p1._id}/comments`, { author: bia._id }, 400);
await call('comentar post inexistente', 'POST', `/posts/${'b'.repeat(24)}/comments`, { author: bia._id, text: 'x' }, 404);
await call('curtir', 'POST', `/posts/${p1._id}/likes`, { user: bia._id }, 201);
await call('curtir de novo (idempotente)', 'POST', `/posts/${p1._id}/likes`, { user: bia._id }, 200);
const feed = await call('feed', 'GET', '/feed', null, 200);
check('feed ordenado por data desc', feed.data[0].createdAt >= feed.data[1].createdAt);
const f = feed.data.find((p) => p._id === p1._id);
check('feed com commentsCount=2, likesCount=1, autor', f.commentsCount === 2 && f.likesCount === 1 && f.author.username === ana.username);
const byTag = await call('feed por hashtag', 'GET', '/feed?hashtag=%23MongoDB', null, 200);
check('filtro hashtag retorna 2', byTag.data.length === 2);
const none = await call('feed hashtag inexistente', 'GET', '/feed?hashtag=zzz', null, 200);
check('filtro vazio', none.data.length === 0);
const top = await call('top hashtags', 'GET', '/hashtags/top', null, 200);
check('top hashtag = mongodb (2)', top[0].hashtag === 'mongodb' && top[0].total === 2);
console.log(fails ? `\n${fails} FALHA(S)` : '\nTODOS OS TESTES PASSARAM');
process.exit(fails ? 1 : 0);
