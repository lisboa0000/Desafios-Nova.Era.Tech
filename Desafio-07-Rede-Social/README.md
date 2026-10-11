# Desafio 07 — Rede social (MongoDB)

API REST (Express + driver oficial do MongoDB) 

## Rodar

```bash
cp .env.example .env   # ajuste MONGODB_URI se necessário
npm install
npm start
npm test               # usa mongodb-memory-server, não precisa de Mongo instalado
```

## Modelagem

- **users**: `{ name, username (único), createdAt }`
- **posts**: `{ author → users._id, content, hashtags[], comments[], commentsCount, likes[], likesCount, createdAt }`
  - **Comentários embutidos** no post: são sempre lidos junto com o post e pertencem a ele. `commentsCount` e `likesCount` são desnormalizados para o feed não precisar contar arrays.
  - **Autor referenciado** (`$lookup` no feed): o usuário é compartilhado e pode mudar de nome.
  - Limitação: embutir comentários é ideal para volume moderado (limite de 16MB por documento). Para milhares de comentários por post, migrar para uma coleção `comments` referenciada.
- Hashtags são extraídas do conteúdo (`#tag`) e/ou do array `hashtags`, normalizadas em minúsculas.
- **Índices**: `users.username` único; `posts.createdAt`, `posts.{hashtags, createdAt}`, `posts.{author, createdAt}`.

## Endpoints

| Método | Rota | Corpo |
|---|---|---|
| POST | `/users` | `{ name, username }` |
| POST | `/posts` | `{ author, content, hashtags? }` |
| POST | `/posts/:id/comments` | `{ author, text }` |
| GET | `/feed?hashtag=&page=&limit=` | feed por data desc, com autor, `commentsCount`, `likesCount`, `recentComments` (3 últimos) |
| POST | `/posts/:id/likes` | `{ user }` — idempotente (opcional) |
| GET | `/hashtags/top?limit=` | top hashtags via aggregation (opcional) |

Erros: 400 (validação), 404 (usuário/post inexistente), 409 (username duplicado).

## Evidências (`prints/`)

| Arquivo | O que comprova |
|---|---|
| `01-npm-test.png` | teste automatizado do fluxo completo |
| `02-test-routes.png` | 25 verificações das rotas (sucesso e erros) |
| `03` a `05` | `/feed`, `/feed?hashtag=` e `/hashtags/top` |
| `06-explain-indices.png` | `explain` com 20 mil posts: `IXSCAN`, só 10 docs examinados (feed geral e por hashtag) |
| `07-erros-validacao.png` | respostas 400, 404 e 409 |

Reproduzir: `node scripts/explain-and-errors.js explain` e `node scripts/explain-and-errors.js errors`.
