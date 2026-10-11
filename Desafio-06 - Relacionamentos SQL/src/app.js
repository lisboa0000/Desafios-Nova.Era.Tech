import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
  decimalNumbers: true,
});

const app = express();
app.use(express.json());

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

/* ---------- Clientes ---------- */
app.post('/customers', wrap(async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) throw new HttpError(400, 'name e email são obrigatórios');
  try {
    const [r] = await pool.execute(
      'INSERT INTO customers (name, email) VALUES (?, ?)', [name, email]);
    res.status(201).json({ id: r.insertId, name, email });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'E-mail já cadastrado');
    throw e;
  }
}));

app.get('/customers', wrap(async (_req, res) => {
  const [rows] = await pool.query('SELECT id, name, email FROM customers');
  res.json(rows);
}));

/* ---------- Produtos (necessários para validar itens) ---------- */
app.post('/products', wrap(async (req, res) => {
  const { name, price, stock = 0 } = req.body;
  if (!name || price == null || price < 0) throw new HttpError(400, 'name e price válidos são obrigatórios');
  const [r] = await pool.execute(
    'INSERT INTO products (name, price, stock) VALUES (?, ?, ?)', [name, price, stock]);
  res.status(201).json({ id: r.insertId, name, price, stock });
}));

app.get('/products', wrap(async (_req, res) => {
  const [rows] = await pool.query('SELECT id, name, price, stock FROM products');
  res.json(rows);
}));

/* ---------- Pedidos ---------- */
// Body: { customer_id: 1, items: [{ product_id: 1, quantity: 2 }, ...] }
app.post('/orders', wrap(async (req, res) => {
  const { customer_id, items } = req.body;
  if (!customer_id || !Array.isArray(items) || items.length === 0)
    throw new HttpError(400, 'customer_id e items (não vazio) são obrigatórios');

  // Agrupa product_id repetido somando quantidades
  const merged = new Map();
  for (const it of items) {
    const q = Number(it.quantity);
    if (!it.product_id || !Number.isInteger(q) || q <= 0)
      throw new HttpError(400, 'Cada item precisa de product_id e quantity inteira > 0');
    merged.set(it.product_id, (merged.get(it.product_id) ?? 0) + q);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [cust] = await conn.execute('SELECT id FROM customers WHERE id = ?', [customer_id]);
    if (cust.length === 0) throw new HttpError(404, 'Cliente não encontrado');

    // Trava os produtos (ordenados p/ evitar deadlock) e valida existência + estoque
    const ids = [...merged.keys()].sort((a, b) => a - b);
    const [products] = await conn.query(
      'SELECT id, name, price, stock FROM products WHERE id IN (?) ORDER BY id FOR UPDATE', [ids]);
    if (products.length !== ids.length) {
      const found = new Set(products.map((p) => p.id));
      throw new HttpError(404, `Produtos não encontrados: ${ids.filter((i) => !found.has(i)).join(', ')}`);
    }
    for (const p of products) {
      if (p.stock < merged.get(p.id))
        throw new HttpError(409, `Estoque insuficiente para "${p.name}" (disponível: ${p.stock})`);
    }

    const [o] = await conn.execute('INSERT INTO orders (customer_id) VALUES (?)', [customer_id]);
    for (const p of products) {
      const qty = merged.get(p.id);
      await conn.execute(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [o.insertId, p.id, qty, p.price]);
      await conn.execute('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, p.id]);
    }

    await conn.commit();
    res.status(201).json(await fetchOrders({ id: o.insertId }).then((r) => r.orders[0]));
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

// Monta pedidos com cliente + itens + total (calculado por query)
async function fetchOrders({ id, page = 1, limit = 10 } = {}) {
  const where = id ? 'WHERE o.id = ?' : '';
  const params = id ? [id] : [];
  const offset = (page - 1) * limit;

  const [orders] = await pool.query(
    `SELECT o.id, o.status, o.created_at, o.canceled_at,
            c.id AS customer_id, c.name AS customer_name, c.email AS customer_email,
            COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       ${where}
      GROUP BY o.id, c.id
      ORDER BY o.created_at DESC, o.id DESC
      ${id ? '' : 'LIMIT ? OFFSET ?'}`,
    id ? params : [limit, offset]);

  let items = [];
  if (orders.length) {
    [items] = await pool.query(
      `SELECT oi.order_id, oi.product_id, p.name AS product_name,
              oi.quantity, oi.unit_price, (oi.quantity * oi.unit_price) AS subtotal
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id IN (?)`, [orders.map((o) => o.id)]);
  }

  const result = orders.map((o) => ({
    id: o.id,
    status: o.status,
    created_at: o.created_at,
    canceled_at: o.canceled_at,
    total: o.total,
    customer: { id: o.customer_id, name: o.customer_name, email: o.customer_email },
    items: items.filter((i) => i.order_id === o.id).map(({ order_id, ...rest }) => rest),
  }));

  let total = null;
  if (!id) [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM orders');
  return { orders: result, total };
}

app.get('/orders', wrap(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const { orders, total } = await fetchOrders({ page, limit });
  res.json({ page, limit, total, total_pages: Math.ceil(total / limit), data: orders });
}));

app.get('/orders/:id', wrap(async (req, res) => {
  const { orders } = await fetchOrders({ id: req.params.id });
  if (!orders.length) throw new HttpError(404, 'Pedido não encontrado');
  res.json(orders[0]);
}));

// Regras: só cancela PENDING ou PAID; já cancelado → 409; SHIPPED/DELIVERED → 422.
// Ao cancelar, devolve o estoque.
app.patch('/orders/:id/cancel', wrap(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.execute('SELECT id, status FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!order) throw new HttpError(404, 'Pedido não encontrado');
    if (order.status === 'CANCELED') throw new HttpError(409, 'Pedido já está cancelado');
    if (!['PENDING', 'PAID'].includes(order.status))
      throw new HttpError(422, `Pedido com status ${order.status} não pode ser cancelado`);

    await conn.execute(
      `UPDATE products p
         JOIN order_items oi ON oi.product_id = p.id
          SET p.stock = p.stock + oi.quantity
        WHERE oi.order_id = ?`, [order.id]);
    await conn.execute(
      "UPDATE orders SET status = 'CANCELED', canceled_at = NOW() WHERE id = ?", [order.id]);

    await conn.commit();
    res.json((await fetchOrders({ id: order.id })).orders[0]);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

/* ---------- Tratamento de erros ---------- */
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.code === 'ER_ROW_IS_REFERENCED_2')
    return res.status(409).json({ error: 'Registro possui vínculos e não pode ser removido' });
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
});

app.listen(process.env.PORT || 3000, () => console.log('API rodando'));
