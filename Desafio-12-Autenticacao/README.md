# Desafio 12 — Autenticação

API NestJS + TypeORM (SQLite via sql.js) com login, JWT, refresh token e autorização por perfil (`admin` / `member`).

## Rodando

```bash
npm install
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=troque-esta-senha JWT_SECRET=um-segredo-longo npm run start:dev
npm test
```

Variáveis: `JWT_SECRET` (obrigatório com `NODE_ENV=production`), `ACCESS_TOKEN_TTL` (padrão `15m`), `REFRESH_TOKEN_TTL` (`7d`), `BCRYPT_ROUNDS` (`12`), `ADMIN_EMAIL`/`ADMIN_PASSWORD` (cria o primeiro admin no boot), `PORT`, `DB_FILE`.

## Endpoints

| Método | Rota | Acesso |
|---|---|---|
| POST | `/auth/register` | público (sempre cria `member`) |
| POST | `/auth/login` | público → `accessToken` + `refreshToken` |
| POST | `/auth/refresh` | público (rotaciona o refresh token) |
| POST | `/auth/logout` | autenticado (invalida o refresh token) |
| GET | `/me` | autenticado |
| GET | `/member/area` | `admin` ou `member` |
| GET | `/admin/users` | só `admin` |
| PATCH | `/admin/users/:id/role` | só `admin` |

Sem token / token inválido ou expirado → `401`. Perfil insuficiente → `403`.

## Decisões de segurança

- Senhas com **bcrypt** (custo 12); nunca armazenadas nem devolvidas em texto puro.
- Access token curto (15 min) e refresh token (7 dias) guardado como hash SHA-256, com **rotação** e rejeição de reuso; logout o invalida. Tokens têm `typ` (access/refresh) e um refresh não funciona como access.
- Login devolve a mesma mensagem para e-mail inexistente e senha errada, com bcrypt executado nos dois casos (sem diferença de timing).
- O perfil é lido do banco a cada requisição: mudar o role de alguém vale imediatamente.
- Cadastro público nunca aceita `role` (`forbidNonWhitelisted`) — evita escalada de privilégio.
- Guards globais: tudo é protegido por padrão; rotas abertas precisam de `@Public()`.
- Fora do escopo: rate limiting/bloqueio por tentativas, HTTPS e 2FA.

