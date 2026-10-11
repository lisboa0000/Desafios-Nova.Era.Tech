# Desafio 09 — Docker Compose

Ambiente completo com um comando: **API** (Node/Express, a rede social do Desafio 07) + **MongoDB** + **Mongo Express** (opcional), com rede interna, volume de persistência, healthchecks e credenciais fora do código.

## Subir

```bash
cp .env.example .env     # troque as senhas
docker compose up -d --build
```

A API sobe em `http://localhost:3000` (porta configurável por `API_PORT`) e só inicia depois que o banco estiver saudável.

```bash
curl http://localhost:3000/health
docker compose ps
docker compose logs -f api
docker compose down          # para tudo, MANTÉM os dados (volume)
docker compose down -v       # para tudo e APAGA os dados
```

## Serviços

| Serviço | Imagem | Função |
|---|---|---|
| `db` | `mongo:7` | banco, com autenticação, volume `mongo_data` e healthcheck (`mongosh ping`) |
| `api` | build local (`Dockerfile`) | API; `depends_on: db (service_healthy)`; healthcheck em `/health`; roda como usuário não-root |
| `mongo-express` | `mongo-express` | perfil `tools`: interface web do banco |
| `smoke` | `node:22-alpine` | perfil `test`: roda `test-routes.mjs` contra a API pela rede do compose |

- **Rede:** `backend`. A API acessa o banco por `db:27017`. O Mongo só é exposto em `127.0.0.1:${DB_HOST_PORT}` (para Compass/mongosh), nunca para a rede externa.
- **Volume:** `mongo_data` em `/data/db`: os dados sobrevivem a `down`/`up` e a reinícios.
- **Credenciais:** todas vêm do `.env` (ignorado pelo git); o código só lê `MONGODB_URI`/`MONGODB_DB` do ambiente. Só `.env.example` é versionado.

## Perfis

```bash
docker compose --profile tools up -d     # inclui Mongo Express em http://localhost:8081 (ME_USER / ME_PASSWORD)
docker compose --profile test run --rm smoke   # teste ponta a ponta contra a API em execução
```

## Variáveis (`.env`)

| Variável | Uso | Padrão |
|---|---|---|
| `API_PORT` | porta da API no host | 3000 |
| `MONGO_USER` / `MONGO_PASSWORD` | usuário root do Mongo | (obrigatório) |
| `MONGO_DB` | nome do banco da aplicação | rede_social |
| `DB_HOST_PORT` | porta do Mongo em localhost | 27018 |
| `ME_PORT`, `ME_USER`, `ME_PASSWORD` | Mongo Express | 8081 / (obrigatório) |

Se aparecer `port is already allocated`, troque `API_PORT` no `.env`.

## Endpoints da API

`GET /health`, `POST /users`, `POST /posts`, `POST /posts/:id/comments`, `POST /posts/:id/likes`, `GET /feed?hashtag=&page=&limit=`, `GET /hashtags/top`. Detalhes no Desafio 07.

## Evidências (`prints/`)

| Arquivo | O que comprova |
|---|---|
| `01-servicos-saudaveis.png` | `db` e `api` healthy, portas e perfis |
| `02-persistencia-volume.png` | dados criados, `compose down`, `compose up`, dados continuam no feed |
| `03-smoke-test.png` | teste ponta a ponta dentro da rede do compose |
| `04-mongo-express-posts.png` | coleção `posts` vista no Mongo Express |
