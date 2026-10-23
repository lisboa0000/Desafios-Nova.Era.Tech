import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule, configureApp } from '../src/app.module';
import { ENTITIES, User } from '../src/database/entities';

describe('Marketplace (e2e, SQLite em memoria)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let adminToken: string;
  let customerToken: string;
  let categoryId: number;
  let productId: number;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [
        AppModule.forRoot({
          db: { type: 'sqljs', entities: ENTITIES, synchronize: true },
          jwtSecret: 'segredo-de-teste',
          accessTtl: '1h',
          bcryptRounds: 4,
        }),
      ],
    }).compile();
    app = mod.createNestApplication();
    configureApp(app, false);
    await app.init();
    http = request(app.getHttpServer());

    const users = app.get(DataSource).getRepository(User);
    await users.save(users.create({ name: 'Admin', email: 'admin@x.com', passwordHash: bcrypt.hashSync('admin12345', 4), role: 'admin' }));

    adminToken = (await http.post('/auth/login').send({ email: 'admin@x.com', password: 'admin12345' }).expect(200)).body.accessToken;
    await http.post('/auth/register').send({ name: 'Cli', email: 'Cli@X.com', password: 'cliente12345' }).expect(201);
    customerToken = (await http.post('/auth/login').send({ email: 'cli@x.com', password: 'cliente12345' }).expect(200)).body.accessToken;
  });
  afterAll(() => app.close());

  it('health responde ok com banco ativo', async () => {
    const r = await http.get('/health').expect(200);
    expect(r.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('rotas protegidas exigem token', async () => {
    await http.get('/me').expect(401);
    await http.get('/orders').expect(401);
    await http.get('/me').set(bearer('lixo')).expect(401);
  });

  it('cadastro nunca cria admin e valida entrada', async () => {
    await http.post('/auth/register').send({ name: 'X', email: 'invalido', password: '1' }).expect(400);
    const r = await http.post('/auth/register').send({ name: 'Eve', email: 'eve@x.com', password: 'senha-forte-1', role: 'admin' });
    expect(r.status).toBe(400);
  });

  it('e-mail duplicado retorna 409 no formato padrao de erro', async () => {
    const r = await http.post('/auth/register').send({ name: 'Cli', email: 'cli@x.com', password: 'cliente12345' }).expect(409);
    expect(r.body).toMatchObject({ statusCode: 409, path: '/auth/register' });
    expect(r.body.timestamp).toBeDefined();
  });

  describe('CRUD de categorias e produtos', () => {
    it('cliente nao cria categoria; admin cria', async () => {
      await http.post('/categories').set(bearer(customerToken)).send({ name: 'Livros' }).expect(403);
      const r = await http.post('/categories').set(bearer(adminToken)).send({ name: 'Livros' }).expect(201);
      categoryId = r.body.id;
      await http.post('/categories').set(bearer(adminToken)).send({ name: 'Livros' }).expect(409);
    });

    it('lista publica, atualiza e valida', async () => {
      expect((await http.get('/categories').expect(200)).body).toHaveLength(1);
      await http.patch(`/categories/${categoryId}`).set(bearer(adminToken)).send({ name: 'Livros Tecnicos' }).expect(200);
      await http.patch(`/categories/${categoryId}`).set(bearer(adminToken)).send({ name: 'a' }).expect(400);
      await http.get('/categories/999').expect(404);
    });

    it('admin cria produto; valida campos e categoria', async () => {
      await http.post('/products').set(bearer(adminToken)).send({ name: 'Clean Code', priceCents: -1, stock: 3, categoryId }).expect(400);
      await http.post('/products').set(bearer(adminToken)).send({ name: 'Clean Code', priceCents: 5000, stock: 3, categoryId: 999 }).expect(400);
      await http.post('/products').set(bearer(customerToken)).send({ name: 'Clean Code', priceCents: 5000, stock: 3, categoryId }).expect(403);
      const r = await http.post('/products').set(bearer(adminToken)).send({ name: 'Clean Code', priceCents: 5000, stock: 3, categoryId }).expect(201);
      productId = r.body.id;
      expect(r.body).toMatchObject({ name: 'Clean Code', priceCents: 5000, stock: 3 });
    });

    it('lista com paginacao e filtros', async () => {
      await http.post('/products').set(bearer(adminToken)).send({ name: 'Refactoring', priceCents: 7000, stock: 1, categoryId }).expect(201);
      const all = await http.get('/products?limit=1&page=2').expect(200);
      expect(all.body.data).toHaveLength(1);
      expect(all.body.meta).toMatchObject({ page: 2, limit: 1, total: 2, totalPages: 2 });
      const found = await http.get('/products?search=Clean').expect(200);
      expect(found.body.data.map((p: any) => p.name)).toEqual(['Clean Code']);
      await http.get('/products?limit=1000').expect(400);
    });

    it('atualizacao parcial e remocao logica', async () => {
      const r = await http.patch(`/products/${productId}`).set(bearer(adminToken)).send({ stock: 10 }).expect(200);
      expect(r.body).toMatchObject({ stock: 10, priceCents: 5000 });
      await http.patch(`/products/${productId}`).set(bearer(adminToken)).send({ foo: 1 }).expect(400);
    });

    it('categoria com produtos nao pode ser removida', async () => {
      await http.delete(`/categories/${categoryId}`).set(bearer(adminToken)).expect(409);
    });
  });

  describe('fluxo de checkout', () => {
    let orderId: number;
    const stock = async () => (await http.get(`/products/${productId}`).expect(200)).body.stock as number;

    it('apenas customer faz checkout; valida payload', async () => {
      await http.post('/orders').set(bearer(adminToken)).send({ items: [{ productId, quantity: 1 }] }).expect(403);
      await http.post('/orders').set(bearer(customerToken)).send({ items: [] }).expect(400);
      await http.post('/orders').set(bearer(customerToken)).send({ items: [{ productId, quantity: 0 }] }).expect(400);
      await http.post('/orders').set(bearer(customerToken)).send({ items: [{ productId: 999, quantity: 1 }] }).expect(404);
    });

    it('cria pedido, calcula total e baixa estoque', async () => {
      const r = await http.post('/orders').set(bearer(customerToken)).send({ items: [{ productId, quantity: 4 }] }).expect(201);
      orderId = r.body.id;
      expect(r.body).toMatchObject({ status: 'pending', totalCents: 20000 });
      expect(r.body.items[0]).toMatchObject({ productName: 'Clean Code', unitPriceCents: 5000, quantity: 4 });
      expect(await stock()).toBe(6);
    });

    it('estoque insuficiente retorna 409 e nao altera nada', async () => {
      const r = await http.post('/orders').set(bearer(customerToken)).send({ items: [{ productId, quantity: 7 }] }).expect(409);
      expect(r.body.message).toContain('Estoque insuficiente');
      expect(await stock()).toBe(6);
    });

    it('mudanca de preco nao afeta pedido existente', async () => {
      await http.patch(`/products/${productId}`).set(bearer(adminToken)).send({ priceCents: 9999 }).expect(200);
      const r = await http.get(`/orders/${orderId}`).set(bearer(customerToken)).expect(200);
      expect(r.body.totalCents).toBe(20000);
    });

    it('outro cliente nao enxerga o pedido; admin enxerga', async () => {
      await http.post('/auth/register').send({ name: 'Bob', email: 'bob@x.com', password: 'senha-bob-123' }).expect(201);
      const bob = (await http.post('/auth/login').send({ email: 'bob@x.com', password: 'senha-bob-123' })).body.accessToken;
      await http.get(`/orders/${orderId}`).set(bearer(bob)).expect(404);
      expect((await http.get('/orders').set(bearer(bob)).expect(200)).body.data).toHaveLength(0);
      await http.get(`/orders/${orderId}`).set(bearer(adminToken)).expect(200);
    });

    it('cancelamento devolve estoque; nao cancela duas vezes', async () => {
      await http.post(`/orders/${orderId}/cancel`).set(bearer(customerToken)).expect(200);
      expect(await stock()).toBe(10);
      await http.post(`/orders/${orderId}/cancel`).set(bearer(customerToken)).expect(409);
    });

    it('fluxo completo: pagar, cliente nao envia, admin envia, nao cancela enviado', async () => {
      const o = (await http.post('/orders').set(bearer(customerToken)).send({ items: [{ productId, quantity: 1 }] }).expect(201)).body;
      await http.post(`/orders/${o.id}/ship`).set(bearer(adminToken)).expect(409);
      expect((await http.post(`/orders/${o.id}/pay`).set(bearer(customerToken)).expect(200)).body.status).toBe('paid');
      await http.post(`/orders/${o.id}/pay`).set(bearer(customerToken)).expect(409);
      await http.post(`/orders/${o.id}/ship`).set(bearer(customerToken)).expect(403);
      await http.post(`/orders/${o.id}/cancel`).set(bearer(customerToken)).expect(403);
      expect((await http.post(`/orders/${o.id}/ship`).set(bearer(adminToken)).expect(200)).body.status).toBe('shipped');
      await http.post(`/orders/${o.id}/cancel`).set(bearer(adminToken)).expect(409);
    });

    it('remover produto o tira do catalogo sem quebrar pedidos antigos', async () => {
      await http.delete(`/products/${productId}`).set(bearer(adminToken)).expect(204);
      await http.get(`/products/${productId}`).expect(404);
      await http.get(`/orders/${orderId}`).set(bearer(customerToken)).expect(200);
    });
  });
});
