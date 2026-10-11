// Requer a API rodando (npm start). Use TEST_URL para outro endereço.
const B = (process.env.TEST_URL || `http://localhost:${process.env.PORT || 3000}`) + '/api/v1';
const ADMIN = { email: process.env.ADMIN_EMAIL || 'admin@example.com', password: process.env.ADMIN_PASSWORD || 'admin123' };
let fails = 0;

async function call(label, method, path, { body, token } = {}, expect) {
  const r = await fetch(B + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const t = await r.text();
  const j = t ? JSON.parse(t) : null;
  const ok = r.status === expect;
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} -> ${r.status} (esperado ${expect})`, ok ? '' : t);
  return j;
}
const check = (label, cond) => { if (!cond) fails++; console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}`); };

const s = Date.now().toString(36);
const adm = (await call('login admin', 'POST', '/auth/login', { body: ADMIN }, 200)).token;
await call('registrar aluno', 'POST', '/auth/register', { body: { name: 'Ana', email: `ana_${s}@x.com`, password: '123456' } }, 201);
await call('registro inválido', 'POST', '/auth/register', { body: { name: 'A', email: 'x', password: '1' } }, 400);
await call('e-mail duplicado', 'POST', '/auth/register', { body: { name: 'Ana', email: `ana_${s}@x.com`, password: '123456' } }, 409);
const stu = (await call('login aluno', 'POST', '/auth/login', { body: { email: `ana_${s}@x.com`, password: '123456' } }, 200)).token;
await call('login senha errada', 'POST', '/auth/login', { body: { email: `ana_${s}@x.com`, password: 'xxxxxx' } }, 401);

const cat = `cat${s}`;
const c = { title: 'Node.js do zero', category: cat, level: 'beginner' };
await call('criar curso sem token', 'POST', '/courses', { body: c }, 401);
await call('criar curso como aluno', 'POST', '/courses', { body: c, token: stu }, 403);
const c1 = await call('criar curso (admin)', 'POST', '/courses', { body: c, token: adm }, 201);
for (let i = 2; i <= 5; i++) await call(`criar curso ${i}`, 'POST', '/courses', { body: { title: `Curso ${i}`, category: cat, level: i > 3 ? 'advanced' : 'beginner' }, token: adm }, 201);
await call('curso inválido', 'POST', '/courses', { body: { title: 'ab', category: 'x', level: 'expert' }, token: adm }, 400);
await call('atualizar curso', 'PUT', `/courses/${c1.id}`, { body: { ...c, title: 'Node.js completo' }, token: adm }, 200);
await call('detalhe curso', 'GET', `/courses/${c1.id}`, {}, 200);
await call('curso inexistente', 'GET', '/courses/999999', {}, 404);

const p1 = await call('listar página 1 (limit 2)', 'GET', `/courses?category=${cat}&limit=2`, {}, 200);
check('meta: total 5, totalPages 3', p1.meta.total === 5 && p1.meta.totalPages === 3 && p1.data.length === 2);
const p3 = await call('listar página 3', 'GET', `/courses?category=${cat}&limit=2&page=3`, {}, 200);
check('última página com 1 item', p3.data.length === 1);
const adv = await call('filtro categoria + nível', 'GET', `/courses?category=${cat}&level=advanced`, {}, 200);
check('filtro retorna 2 avançados', adv.meta.total === 2);
await call('nível inválido', 'GET', '/courses?level=xyz', {}, 400);

await call('matricular', 'POST', `/courses/${c1.id}/enrollments`, { token: stu }, 201);
await call('matrícula duplicada', 'POST', `/courses/${c1.id}/enrollments`, { token: stu }, 409);
await call('matricular sem token', 'POST', `/courses/${c1.id}/enrollments`, {}, 401);
const mine = await call('minhas matrículas', 'GET', '/me/enrollments', { token: stu }, 200);
check('1 matrícula', mine.length === 1);
await call('alunos do curso como aluno', 'GET', `/courses/${c1.id}/enrollments`, { token: stu }, 403);
await call('alunos do curso (admin)', 'GET', `/courses/${c1.id}/enrollments`, { token: adm }, 200);
await call('cancelar matrícula', 'DELETE', `/courses/${c1.id}/enrollments`, { token: stu }, 204);
await call('remover curso (admin)', 'DELETE', `/courses/${c1.id}`, { token: adm }, 204);

console.log(fails ? `\n${fails} FALHA(S)` : '\nTODOS OS TESTES PASSARAM');
process.exit(fails ? 1 : 0);
