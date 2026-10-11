import 'dotenv/config';

// Requer a API rodando (npm start). Use TEST_URL para outro endereço.
const B = process.env.TEST_URL || `http://localhost:${process.env.PORT || 3000}`;
let fails = 0;
async function call(label, method, path, body, expect) {
  const r = await fetch(B + path, {
    method, headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => null);
  const ok = r.status === expect;
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} -> ${r.status} (esperado ${expect})`, ok ? '' : JSON.stringify(j));
  return j;
}
const email = `t${Date.now()}@x.com`;
const c = await call('criar cliente', 'POST', '/customers', { name: 'Ana', email }, 201);
await call('cliente duplicado', 'POST', '/customers', { name: 'Ana', email }, 409);
await call('cliente sem email', 'POST', '/customers', { name: 'Ana' }, 400);
await call('listar clientes', 'GET', '/customers', null, 200);
const p1 = await call('criar produto 1', 'POST', '/products', { name: 'Mouse', price: 50.5, stock: 10 }, 201);
const p2 = await call('criar produto 2', 'POST', '/products', { name: 'Teclado', price: 120, stock: 3 }, 201);
await call('produto invalido', 'POST', '/products', { name: 'X', price: -1 }, 400);
await call('listar produtos', 'GET', '/products', null, 200);
const o = await call('criar pedido', 'POST', '/orders', { customer_id: c.id, items: [{ product_id: p1.id, quantity: 2 }, { product_id: p2.id, quantity: 1 }] }, 201);
console.log('   total =', o.total, '(esperado 221)');
if (o.total !== 221) fails++;
await call('pedido cliente inexistente', 'POST', '/orders', { customer_id: 99999, items: [{ product_id: p1.id, quantity: 1 }] }, 404);
await call('pedido produto inexistente', 'POST', '/orders', { customer_id: c.id, items: [{ product_id: 99999, quantity: 1 }] }, 404);
await call('pedido estoque insuficiente', 'POST', '/orders', { customer_id: c.id, items: [{ product_id: p2.id, quantity: 50 }] }, 409);
await call('pedido sem itens', 'POST', '/orders', { customer_id: c.id, items: [] }, 400);
await call('pedido qtd invalida', 'POST', '/orders', { customer_id: c.id, items: [{ product_id: p1.id, quantity: 0 }] }, 400);
const before = (await (await fetch(B + '/products')).json()).find((x) => x.id === p1.id).stock;
console.log('   estoque mouse apos pedido =', before, '(esperado 8)');
if (before !== 8) fails++;
await call('listar pedidos', 'GET', '/orders?page=1&limit=5', null, 200);
await call('buscar pedido', 'GET', `/orders/${o.id}`, null, 200);
await call('pedido inexistente', 'GET', '/orders/99999', null, 404);
await call('cancelar pedido', 'PATCH', `/orders/${o.id}/cancel`, null, 200);
const after = (await (await fetch(B + '/products')).json()).find((x) => x.id === p1.id).stock;
console.log('   estoque mouse apos cancelar =', after, '(esperado 10)');
if (after !== 10) fails++;
await call('cancelar de novo', 'PATCH', `/orders/${o.id}/cancel`, null, 409);
await call('cancelar inexistente', 'PATCH', '/orders/99999/cancel', null, 404);
console.log(fails ? `\n${fails} falha(s)` : '\nTudo passou');
process.exit(fails ? 1 : 0);
