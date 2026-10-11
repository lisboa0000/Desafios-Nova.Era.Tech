# Desafio 06 — API de Pedidos (MySQL + Express)

API REST de pedidos com relacionamentos SQL: clientes (1:N) pedidos (N:N) produtos.

## Requisitos
- Node.js 18+
- MySQL 8.x rodando na porta 3306 (no Windows: `winget install Oracle.MySQL`)

## Como rodar

**1. Criar o banco** (cria o banco `orders_api` e as 4 tabelas)

```bash
mysql -u root -p < schema.sql
```

Alternativa: abrir o `schema.sql` no MySQL Workbench e executar com o raio ⚡.

**2. Configurar o `.env`**

```bash
cp .env.example .env      # no PowerShell: copy .env.example .env
```

Edite o `.env` com a senha do seu MySQL:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=orders_api
PORT=3000
```

Se a porta 3000 já estiver em uso (erro `EADDRINUSE`), troque o `PORT`, por exemplo para `3001`.

**3. Instalar e iniciar a API**

```bash
npm install
npm start
```

Deve aparecer `API rodando`.

**4. Rodar os testes** (com a API rodando, em outro terminal)

```bash
npm test
```

O teste (`test-routes.mjs`) chama todas as rotas e confere status, total do pedido e devolução de estoque. Termina com `Tudo passou` quando está tudo certo. Ele cria dados no banco a cada execução; para voltar ao estado inicial, rode o passo 1 de novo após `DROP DATABASE orders_api;`.

## Endpoints
| Método | Rota | Descrição |
|---|---|---|
| POST | /customers | cadastra cliente `{name, email}` |
| GET | /customers | lista clientes |
| POST | /products | cadastra produto `{name, price, stock}` |
| GET | /products | lista produtos |
| POST | /orders | cria pedido `{customer_id, items:[{product_id, quantity}]}` |
| GET | /orders?page=1&limit=10 | lista paginada (cliente + itens + total) |
| GET | /orders/:id | detalhe do pedido |
| PATCH | /orders/:id/cancel | cancela pedido (só PENDING/PAID; devolve estoque) |

Erros: `400` dados inválidos, `404` não encontrado, `409` conflito (e-mail duplicado, estoque insuficiente, pedido já cancelado), `422` pedido não cancelável.

## Exemplo rápido

```bash
curl -X POST localhost:3000/customers -H "Content-Type: application/json" -d '{"name":"Ana","email":"ana@x.com"}'
curl -X POST localhost:3000/products  -H "Content-Type: application/json" -d '{"name":"Mouse","price":50.5,"stock":10}'
curl -X POST localhost:3000/orders    -H "Content-Type: application/json" -d '{"customer_id":1,"items":[{"product_id":1,"quantity":2}]}'
curl localhost:3000/orders
```

## Regras de integridade
- `orders.customer_id` → `ON DELETE RESTRICT`, `ON UPDATE CASCADE`
- `order_items.order_id` → `ON DELETE CASCADE`
- `order_items.product_id` → `ON DELETE RESTRICT`
- `unit_price` guardado no item (histórico de preço)
- Criação e cancelamento rodam em transação, com `SELECT ... FOR UPDATE`

## Evidências
Prints e saídas dos testes na pasta [`prints/`](prints).
