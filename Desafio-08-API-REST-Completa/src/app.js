const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { AppError, errors } = require('./errors');
const { openapi, docsHtml } = require('./openapi');

const LEVELS = ['beginner', 'intermediate', 'advanced'];

const schemas = {
  register: z.object({ name: z.string().trim().min(2), email: z.string().trim().toLowerCase().email(), password: z.string().min(6) }),
  login: z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }),
  course: z.object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(2000).default(''),
    category: z.string().trim().min(2).max(60).toLowerCase(),
    level: z.enum(LEVELS),
  }),
  list: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    category: z.string().trim().toLowerCase().optional(),
    level: z.enum(LEVELS).optional(),
    q: z.string().trim().optional(),
  }),
};

function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw errors.validation(r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }
  return r.data;
}

const toId = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw errors.validation([{ field: 'id', message: 'id inválido' }]);
  return n;
};

const publicUser = ({ id, name, email, role }) => ({ id, name, email, role });

function createApp({ db, jwtSecret, jwtExpiresIn = '2h' }) {
  const wrap = (fn) => (req, res, next) => { try { fn(req, res); } catch (e) { next(e); } };

  // --- middlewares ---
  const authenticate = (req, res, next) => {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) return next(errors.unauthorized());
    try {
      const payload = jwt.verify(token, jwtSecret);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
      if (!user) return next(errors.unauthorized('Usuário do token não existe mais'));
      req.user = user;
      next();
    } catch {
      next(errors.unauthorized('Token inválido ou expirado'));
    }
  };
  const requireRole = (role) => (req, res, next) => (req.user.role === role ? next() : next(errors.forbidden()));
  const getCourse = (id) => {
    const c = db.prepare('SELECT * FROM courses WHERE id = ?').get(id);
    if (!c) throw errors.notFound('Curso');
    return c;
  };

  const v1 = express.Router();

  // --- auth ---
  v1.post('/auth/register', wrap((req, res) => {
    const { name, email, password } = parse(schemas.register, req.body);
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw errors.conflict('E-mail já cadastrado');
    const r = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, bcrypt.hashSync(password, 10));
    res.status(201).json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid)));
  }));

  v1.post('/auth/login', wrap((req, res) => {
    const { email, password } = parse(schemas.login, req.body);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) throw errors.unauthorized('Credenciais inválidas');
    const token = jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: jwtExpiresIn });
    res.json({ token, user: publicUser(user) });
  }));

  // --- cursos (leitura pública, escrita só admin) ---
  v1.get('/courses', wrap((req, res) => {
    const { page, limit, category, level, q } = parse(schemas.list, req.query);
    const where = [];
    const params = [];
    if (category) { where.push('category = ?'); params.push(category); }
    if (level) { where.push('level = ?'); params.push(level); }
    if (q) { where.push('title LIKE ?'); params.push(`%${q}%`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM courses ${clause}`).get(...params);
    const data = db.prepare(`SELECT * FROM courses ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }));

  v1.get('/courses/:id', wrap((req, res) => res.json(getCourse(toId(req.params.id)))));

  v1.post('/courses', authenticate, requireRole('admin'), wrap((req, res) => {
    const c = parse(schemas.course, req.body);
    const r = db.prepare('INSERT INTO courses (title, description, category, level) VALUES (?, ?, ?, ?)').run(c.title, c.description, c.category, c.level);
    res.status(201).json(getCourse(Number(r.lastInsertRowid)));
  }));

  v1.put('/courses/:id', authenticate, requireRole('admin'), wrap((req, res) => {
    const id = toId(req.params.id);
    getCourse(id);
    const c = parse(schemas.course, req.body);
    db.prepare('UPDATE courses SET title = ?, description = ?, category = ?, level = ? WHERE id = ?').run(c.title, c.description, c.category, c.level, id);
    res.json(getCourse(id));
  }));

  v1.delete('/courses/:id', authenticate, requireRole('admin'), wrap((req, res) => {
    const id = toId(req.params.id);
    getCourse(id);
    db.prepare('DELETE FROM courses WHERE id = ?').run(id);
    res.status(204).end();
  }));

  // --- matrículas ---
  v1.post('/courses/:id/enrollments', authenticate, wrap((req, res) => {
    const course = getCourse(toId(req.params.id));
    try {
      const r = db.prepare('INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)').run(req.user.id, course.id);
      res.status(201).json(db.prepare('SELECT * FROM enrollments WHERE id = ?').get(r.lastInsertRowid));
    } catch (e) {
      if (/UNIQUE/.test(e.message)) throw errors.conflict('Usuário já matriculado neste curso');
      throw e;
    }
  }));

  v1.delete('/courses/:id/enrollments', authenticate, wrap((req, res) => {
    const course = getCourse(toId(req.params.id));
    const r = db.prepare('DELETE FROM enrollments WHERE user_id = ? AND course_id = ?').run(req.user.id, course.id);
    if (!r.changes) throw errors.notFound('Matrícula');
    res.status(204).end();
  }));

  v1.get('/courses/:id/enrollments', authenticate, requireRole('admin'), wrap((req, res) => {
    const course = getCourse(toId(req.params.id));
    res.json(db.prepare(`SELECT e.id, e.created_at, u.id AS user_id, u.name, u.email FROM enrollments e
      JOIN users u ON u.id = e.user_id WHERE e.course_id = ? ORDER BY e.id`).all(course.id));
  }));

  v1.get('/me/enrollments', authenticate, wrap((req, res) => {
    res.json(db.prepare(`SELECT e.id, e.created_at, c.id AS course_id, c.title, c.category, c.level FROM enrollments e
      JOIN courses c ON c.id = e.course_id WHERE e.user_id = ? ORDER BY e.id DESC`).all(req.user.id));
  }));

  const app = express();
  app.use(express.json());
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/docs', (req, res) => res.type('html').send(docsHtml));
  app.get('/api/v1/openapi.json', (req, res) => res.json(openapi));
  app.use('/api/v1', v1);

  app.use((req, res, next) => next(new AppError(404, 'ROUTE_NOT_FOUND', 'Rota não encontrada')));
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') err = new AppError(400, 'INVALID_JSON', 'JSON inválido');
    if (!(err instanceof AppError)) {
      console.error(err);
      err = new AppError(500, 'INTERNAL_ERROR', 'Erro interno');
    }
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details ?? null } });
  });
  return app;
}

function seedAdmin(db, email, password) {
  if (!email || !password || db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return;
  db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES ('Admin', ?, ?, 'admin')").run(email, bcrypt.hashSync(password, 10));
}

module.exports = { createApp, seedAdmin };
