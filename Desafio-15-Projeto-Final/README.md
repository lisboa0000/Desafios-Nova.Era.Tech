# Desafio 15 - Projeto Final: Marketplace API

## Visao geral

API backend de um marketplace. Clientes se cadastram, navegam pelo catalogo e fazem pedidos (checkout com baixa de estoque). Administradores gerenciam categorias e produtos e conduzem o pedido ate o envio.

Stack: Node.js 20, TypeScript, NestJS 10, TypeORM, MySQL 8, JWT, class-validator, Jest + Supertest, Docker Compose.

Entidades: `User`, `Category`, `Product`, `Order`, `OrderItem`.

- CRUD completo: categorias e produtos.
- Autenticacao JWT com perfis `admin` e `customer`.
- Fluxo composto: checkout -> pagamento -> envio / cancelamento, com controle transacional de estoque.

## Arquitetura

```
Cliente HTTP
    |
    v
Middleware (x-request-id, log JSON) -> ValidationPipe -> AuthGuard -> RolesGuard
    |
    v
Controllers  ->  Services (regras de negocio)  ->  TypeORM  ->  MySQL
    |
    v
AllExceptionsFilter (formato unico de erro)
```

```
src/
  auth/         registro, login, JWT, guards (AuthGuard global + RolesGuard)
  categories/   CRUD de categorias
  products/     CRUD de produtos, listagem paginada com filtros
  orders/       checkout, listagem, pagar, enviar, cancelar
    order.rules.ts   maquina de estados do pedido (funcoes puras)
  health/       GET /health
  common/       decorators, filtro de excecoes, logger, paginacao
  database/     entidades, migracoes, data-source, seed
test/           unitarios (com mocks) e e2e
```

Modelo de dados:

```
users 1---N orders 1---N order_items N---1 products N---1 categories
```

Maquina de estados do pedido:

```
pending --pay--> paid --ship (admin)--> shipped
   |               |
   +---cancel------+--> cancelled   (cancelar devolve o estoque)
```

## Setup

### Com Docker (ambiente completo)

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec api node dist/database/seed.js
```

A API sobe em `http://localhost:3000`. As migracoes rodam automaticamente no boot. O seed cria:

| Perfil | E-mail | Senha |
|---|---|---|
| admin | `admin@marketplace.dev` | `admin12345` (ou `ADMIN_PASSWORD`) |
| customer | `cliente@marketplace.dev` | `cliente12345` |

Alem de 2 categorias e 4 produtos. O seed e idempotente.

### Local (sem Docker para a API)

```bash
npm install
docker compose up -d db
npm run start:dev
npm run seed
```

### Testes

```bash
npm install
npm test
```

Os testes usam SQLite em memoria (sql.js): nenhum banco ou servico externo e necessario. Sao 37 testes: regras de transicao, `OrdersService` e `AuthService` com mocks, e um e2e cobrindo autenticacao, autorizacao, CRUD e todo o fluxo de checkout.

### Variaveis de ambiente

| Variavel | Padrao | Descricao |
|---|---|---|
| `PORT` | `3000` | porta da API |
| `JWT_SECRET` | obrigatorio em producao | segredo de assinatura |
| `ACCESS_TOKEN_TTL` | `1h` | validade do token |
| `BCRYPT_ROUNDS` | `12` | custo do hash |
| `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` | `localhost`, `3306`, `marketplace` | conexao MySQL |
| `ADMIN_EMAIL` `ADMIN_PASSWORD` | ver seed | conta admin criada pelo seed |
| `LOG_REQUESTS` | `true` | log JSON por requisicao |

### Migracoes

```bash
npm run migration:run
npm run migration:revert
```

## Rotas

Valores monetarios sao inteiros em centavos (`priceCents`). Erros seguem `{ statusCode, error, message, path, timestamp }`.

| Metodo | Rota | Acesso | Descricao |
|---|---|---|---|
| GET | `/health` | publico | status da API e do banco |
| POST | `/auth/register` | publico | cria cliente (`name`, `email`, `password`) |
| POST | `/auth/login` | publico | retorna `accessToken` e usuario |
| GET | `/me` | autenticado | dados do usuario logado |
| GET | `/categories` | publico | lista categorias |
| GET | `/categories/:id` | publico | detalhe |
| POST | `/categories` | admin | cria |
| PATCH | `/categories/:id` | admin | renomeia |
| DELETE | `/categories/:id` | admin | remove (409 se tiver produtos) |
| GET | `/products` | publico | lista; query `page`, `limit`, `categoryId`, `search` |
| GET | `/products/:id` | publico | detalhe |
| POST | `/products` | admin | cria |
| PATCH | `/products/:id` | admin | atualizacao parcial |
| DELETE | `/products/:id` | admin | remocao logica (`active=false`) |
| POST | `/orders` | customer | checkout: `{ "items": [{ "productId": 1, "quantity": 2 }] }` |
| GET | `/orders` | autenticado | customer ve os proprios; admin ve todos |
| GET | `/orders/:id` | dono ou admin | detalhe com itens |
| POST | `/orders/:id/pay` | dono ou admin | pending -> paid |
| POST | `/orders/:id/ship` | admin | paid -> shipped |
| POST | `/orders/:id/cancel` | dono (pendente) ou admin | devolve estoque |

Codigos: `400` validacao, `401` sem token/token invalido, `403` perfil sem permissao, `404` inexistente (inclui pedido de outro usuario), `409` conflito (e-mail repetido, estoque insuficiente, transicao invalida).

Exemplo:

```bash
TOKEN=$(curl -s -X POST localhost:3000/auth/login -H 'content-type: application/json' \
  -d '{"email":"cliente@marketplace.dev","password":"cliente12345"}' | jq -r .accessToken)

curl -X POST localhost:3000/orders -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"items":[{"productId":1,"quantity":2}]}'
```

## Decisoes tecnicas

- **Estoque sem race condition:** a baixa e um `UPDATE ... SET stock = stock - n WHERE id = ? AND stock >= n`. Se nenhuma linha for afetada, o checkout falha com 409 e a transacao inteira e revertida. Duas compras simultaneas da ultima unidade nao vendem duas vezes, sem precisar de lock explicito.
- **Transicoes de pedido tambem atomicas:** o status so muda se ainda for o lido (`WHERE status = ?`), evitando que dois cancelamentos devolvam o estoque duas vezes.
- **Preco congelado:** `OrderItem` guarda nome e preco unitario no momento da compra.
- **Dinheiro em centavos inteiros**, evitando erros de ponto flutuante.
- **Remocao logica de produtos:** produtos com historico de pedidos nao podem ser apagados sem quebrar a integridade; `DELETE` apenas os tira do catalogo.
- **Seguranca:** senhas com bcrypt; JWT HS256 com algoritmo fixo na verificacao; usuario recarregado do banco a cada requisicao (perfil e exclusao valem imediatamente); login com mesma mensagem e custo para usuario inexistente e senha errada; cadastro nunca aceita `role` (`whitelist` + `forbidNonWhitelisted`); pedido alheio responde 404 para nao vazar existencia.
- **Autenticacao por padrao:** `AuthGuard` e global; rotas abertas precisam de `@Public()` explicito.
- **Migracoes versionadas** em MySQL (`synchronize: false`); testes usam `synchronize` em SQLite em memoria para rodar sem dependencias.
- **Observabilidade:** log JSON por requisicao com `requestId` (propagado no header `x-request-id`), `GET /health` verificando o banco e `HEALTHCHECK` no Dockerfile.
- **Docker:** build multi-stage, imagem final so com dependencias de producao, execucao como usuario nao-root; a API aguarda o MySQL ficar saudavel.
