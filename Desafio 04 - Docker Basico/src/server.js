const express = require('express');
const { pool, ensureSchema } = require('./db');

const app = express();
app.use(express.json());

const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);

app.get('/', (req, res) => {
  res.json({
    name: 'desafio-docker-api',
    status: 'online',
    endpoints: ['GET /health', 'GET /tasks', 'GET /tasks/:id', 'POST /tasks', 'PUT /tasks/:id', 'DELETE /tasks/:id']
  });
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ api: 'ok', database: 'ok' });
  } catch (err) {
    res.status(503).json({ api: 'ok', database: 'indisponivel', detail: err.message });
  }
});

app.get(
  '/tasks',
  asyncHandler(async (req, res) => {
    await ensureSchema();
    const { rows } = await pool.query('SELECT * FROM tasks ORDER BY id');
    res.json(rows);
  })
);

app.get(
  '/tasks/:id',
  asyncHandler(async (req, res) => {
    await ensureSchema();
    const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Tarefa nao encontrada' });
    res.json(rows[0]);
  })
);

app.post(
  '/tasks',
  asyncHandler(async (req, res) => {
    const { title } = req.body || {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'O campo title e obrigatorio' });
    }
    await ensureSchema();
    const { rows } = await pool.query('INSERT INTO tasks (title) VALUES ($1) RETURNING *', [title.trim()]);
    res.status(201).json(rows[0]);
  })
);

app.put(
  '/tasks/:id',
  asyncHandler(async (req, res) => {
    const { title, done } = req.body || {};
    if (title === undefined && done === undefined) {
      return res.status(400).json({ error: 'Informe title e/ou done' });
    }
    await ensureSchema();
    const { rows } = await pool.query(
      `UPDATE tasks
         SET title = COALESCE($1, title),
             done = COALESCE($2, done)
       WHERE id = $3
       RETURNING *`,
      [title ?? null, done ?? null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Tarefa nao encontrada' });
    res.json(rows[0]);
  })
);

app.delete(
  '/tasks/:id',
  asyncHandler(async (req, res) => {
    await ensureSchema();
    const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Tarefa nao encontrada' });
    res.status(204).send();
  })
);

app.use((req, res) => {
  res.status(404).json({ error: 'Rota nao encontrada' });
});

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: 'Erro interno', detail: err.message });
});

const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`API rodando na porta ${port}`);
});

function shutdown() {
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
