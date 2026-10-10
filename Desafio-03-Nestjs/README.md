# Desafio 03 — API com NestJS

API de usuários com arquitetura modular, DTOs e validação.

## Como rodar
```bash
npm install
npm run start:dev
```
A API sobe em `http://localhost:3000`.

## Endpoints (disponíveis em `/users` e `/v1/users`)
| Método | Rota | Descrição | Status |
|---|---|---|---|
| POST | /users | Cria usuário | 201 / 400 / 409 |
| GET | /users | Lista usuários (filtro opcional `?role=admin`) | 200 / 400 |
| GET | /users/:id | Busca por id (UUID) | 200 / 400 / 404 |
| PATCH | /users/:id | Atualiza parcialmente | 200 / 400 / 404 / 409 |

## Exemplo
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Maria","email":"maria@email.com","role":"admin"}'
```

## Estrutura
```
src/
├── main.ts
├── app.module.ts
└── users/
    ├── users.module.ts
    ├── users.controller.ts
    ├── users.service.ts
    ├── dto/ (create, update, query)
    ├── entities/user.entity.ts
    └── enums/user-role.enum.ts
```

## Extras implementados
- Versionamento de rotas (`/v1/users`)
- Filtro por `role` (`GET /users?role=member`)
- Email único (409 Conflict)
