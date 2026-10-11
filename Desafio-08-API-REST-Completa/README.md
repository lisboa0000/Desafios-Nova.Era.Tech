# Desafio 08 — API REST completa (gestão de cursos)

API REST em Node.js (Express) com autenticação JWT, permissões por papel, paginação, filtros, validação com Zod, erros padronizados e documentação OpenAPI/Swagger. Banco SQLite embutido (`node:sqlite`), sem instalar nada além do Node.

## Rodar

Requer Node 22.13+.

```bash
cp .env.example .env
npm install
npm start          # http://localhost:3000  |  docs em /docs
npm test           # testes automatizados (banco em memória)
node test-routes.mjs   # testa a API em execução (com `npm start` ligado)
```

Na primeira execução é criado um admin com `ADMIN_EMAIL` / `ADMIN_PASSWORD` do `.env`. Quem se cadastra em `/auth/register` sempre vira `student`.

## Modelagem

- `users` (id, name, email único, password_hash, role `admin|student`)
- `courses` (id, title, description, category, level `beginner|intermediate|advanced`) — índice em `(category, level)`
- `enrollments` (user_id, course_id) — `UNIQUE(user_id, course_id)`, remoção em cascata

## Endpoints (`/api/v1`)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/auth/register` | público | `{ name, email, password(min 6) }` → 201 |
| POST | `/auth/login` | público | `{ email, password }` → `{ token, user }` |
| GET | `/courses` | público | lista paginada com filtros |
| GET | `/courses/:id` | público | detalhe |
| POST | `/courses` | admin | `{ title, description?, category, level }` → 201 |
| PUT | `/courses/:id` | admin | atualiza |
| DELETE | `/courses/:id` | admin | remove → 204 |
| POST | `/courses/:id/enrollments` | logado | matricula o usuário do token → 201 |
| DELETE | `/courses/:id/enrollments` | logado | cancela a própria matrícula → 204 |
| GET | `/courses/:id/enrollments` | admin | alunos do curso |
| GET | `/me/enrollments` | logado | minhas matrículas |

Rotas protegidas usam `Authorization: Bearer <token>`.

### Listagem: `GET /courses?page=1&limit=10&category=backend&level=advanced&q=node`

```json
{
  "data": [{ "id": 3, "title": "Node.js", "description": "", "category": "backend", "level": "advanced", "created_at": "..." }],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

`limit` máximo 100. `category` é normalizada em minúsculas; `q` busca no título.

### Padrão de erro

Toda falha tem o mesmo formato:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Dados inválidos", "details": [{ "field": "email", "message": "Invalid email" }] } }
```

| Status | `code` |
|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_JSON` |
| 401 | `UNAUTHORIZED` (sem token, token inválido/expirado, credenciais erradas) |
| 403 | `FORBIDDEN` (aluno em rota de admin) |
| 404 | `NOT_FOUND`, `ROUTE_NOT_FOUND` |
| 409 | `CONFLICT` (e-mail ou matrícula duplicados) |
| 500 | `INTERNAL_ERROR` |

## Opcionais feitos

- **Swagger/OpenAPI:** UI em `/docs`, especificação em `/api/v1/openapi.json`.
- **Versionamento:** todas as rotas sob `/api/v1`.

## Evidências (`prints/`)

| Arquivo | O que comprova |
|---|---|
| `01-npm-test.png` | 6 testes automatizados passando |
| `02-test-routes.png` | fluxo ponta a ponta contra a API rodando |
| `03-courses-paginado-filtro.png` | paginação e filtro funcionando |
| `04-swagger-docs.png` | documentação Swagger |
