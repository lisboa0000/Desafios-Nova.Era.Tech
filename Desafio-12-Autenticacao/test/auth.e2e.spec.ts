import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { configureApp, createAppModule } from '../src/app.module';

const SECRET = 'test-secret';
const opts = { jwtSecret: SECRET, accessTtl: 2, refreshTtl: '1h', bcryptRounds: 4, adminEmail: 'admin@x.com', adminPassword: 'adminpass123' };

describe('Autenticação e autorização', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const user = { name: 'Ana', email: 'Ana@Example.com', password: 'senha-forte-1' };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [createAppModule(opts)] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
  });
  afterAll(() => app.close());

  const login = (email: string, password: string) => http.post('/auth/login').send({ email, password });

  it('registra sem expor hash/senha e sempre como member', async () => {
    const r = await http.post('/auth/register').send(user).expect(201);
    expect(r.body.data).toMatchObject({ name: 'Ana', email: 'ana@example.com', role: 'member' });
    expect(JSON.stringify(r.body)).not.toMatch(/password|hash/i);
  });

  it('não permite escolher role no cadastro nem repetir e-mail', async () => {
    await http.post('/auth/register').send({ ...user, email: 'x@x.com', role: 'admin' }).expect(400);
    await http.post('/auth/register').send(user).expect(409);
  });

  it('valida entrada (e-mail inválido, senha curta)', async () => {
    await http.post('/auth/register').send({ name: 'Bo', email: 'nope', password: '12345678' }).expect(400);
    await http.post('/auth/register').send({ name: 'Bo', email: 'bo@x.com', password: 'curta' }).expect(400);
  });

  it('login com mensagem idêntica para senha errada e e-mail inexistente', async () => {
    const a = await login('ana@example.com', 'errada-errada').expect(401);
    const b = await login('ninguem@example.com', 'errada-errada').expect(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('GET /me exige token válido', async () => {
    await http.get('/me').expect(401);
    await http.get('/me').set(bearer('lixo')).expect(401);
    const forged = jwt.sign({ typ: 'access' }, 'outro-segredo', { subject: '1' });
    await http.get('/me').set(bearer(forged)).expect(401);

    const { accessToken } = (await login('ANA@example.com', user.password).expect(200)).body;
    const me = await http.get('/me').set(bearer(accessToken)).expect(200);
    expect(me.body.data.email).toBe('ana@example.com');
  });

  it('member recebe 403 em rota de admin; admin recebe 200', async () => {
    const member = (await login('ana@example.com', user.password)).body.accessToken;
    await http.get('/admin/users').set(bearer(member)).expect(403);
    const admin = (await login('admin@x.com', 'adminpass123').expect(200)).body.accessToken;
    const list = await http.get('/admin/users').set(bearer(admin)).expect(200);
    expect(list.body.data).toHaveLength(2);
    await http.get('/member/area').set(bearer(member)).expect(200);
  });

  it('admin altera perfil e o efeito é imediato', async () => {
    const member = (await login('ana@example.com', user.password)).body.accessToken;
    const admin = (await login('admin@x.com', 'adminpass123')).body.accessToken;
    const id = (await http.get('/me').set(bearer(member))).body.data.id;
    await http.patch(`/admin/users/${id}/role`).set(bearer(member)).send({ role: 'admin' }).expect(403);
    await http.patch(`/admin/users/${id}/role`).set(bearer(admin)).send({ role: 'superuser' }).expect(400);
    await http.patch(`/admin/users/${id}/role`).set(bearer(admin)).send({ role: 'admin' }).expect(200);
    await http.get('/admin/users').set(bearer(member)).expect(200);
    await http.patch(`/admin/users/${id}/role`).set(bearer(admin)).send({ role: 'member' }).expect(200);
    await http.get('/admin/users').set(bearer(member)).expect(403);
  });

  it('access token expira', async () => {
    const { accessToken } = (await login('ana@example.com', user.password)).body;
    await http.get('/me').set(bearer(accessToken)).expect(200);
    await new Promise((r) => setTimeout(r, 2300));
    await http.get('/me').set(bearer(accessToken)).expect(401);
  });

  it('refresh token rotaciona, rejeita reuso e não vale como access token', async () => {
    const t1 = (await login('ana@example.com', user.password)).body;
    await http.get('/me').set(bearer(t1.refreshToken)).expect(401);
    const t2 = (await http.post('/auth/refresh').send({ refreshToken: t1.refreshToken }).expect(200)).body;
    await http.get('/me').set(bearer(t2.accessToken)).expect(200);
    await http.post('/auth/refresh').send({ refreshToken: t1.refreshToken }).expect(401);
    await http.post('/auth/refresh').send({ refreshToken: t1.accessToken }).expect(401);
  });

  it('logout invalida o refresh token', async () => {
    const t = (await login('ana@example.com', user.password)).body;
    await http.post('/auth/logout').set(bearer(t.accessToken)).expect(204);
    await http.post('/auth/refresh').send({ refreshToken: t.refreshToken }).expect(401);
  });
});
