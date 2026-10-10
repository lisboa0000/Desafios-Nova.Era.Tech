# Desafio 04 - Docker basico

API Node.js (Express + PostgreSQL) containerizada com Docker.

## Estrutura

```
.
├── Dockerfile
├── .dockerignore
├── .env.example
├── package.json
├── package-lock.json
└── src
    ├── db.js
    └── server.js
```

## Endpoints

| Metodo | Rota         | Descricao                  |
|--------|--------------|----------------------------|
| GET    | /            | Informacoes da API         |
| GET    | /health      | Status da API e do banco   |
| GET    | /tasks       | Lista tarefas              |
| GET    | /tasks/:id   | Busca uma tarefa           |
| POST   | /tasks       | Cria tarefa (`title`)      |
| PUT    | /tasks/:id   | Atualiza (`title`, `done`) |
| DELETE | /tasks/:id   | Remove tarefa              |

## Variaveis de ambiente

| Variavel    | Descricao        | Padrao    |
|-------------|------------------|-----------|
| PORT        | Porta da API     | 3000      |
| DB_HOST     | Host do banco    | localhost |
| DB_PORT     | Porta do banco   | 5432      |
| DB_USER     | Usuario do banco | postgres  |
| DB_PASSWORD | Senha do banco   | postgres  |
| DB_NAME     | Nome do banco    | postgres  |

## Como executar

1. Criar a rede Docker:

```bash
docker network create rede-desafio
```

2. Subir o PostgreSQL:

```bash
docker run -d \
  --name db \
  --network rede-desafio \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=desafio \
  postgres:16-alpine
```

3. Gerar a imagem da API:

```bash
docker build -t minha-api:1.0 .
```

4. Subir o container da API:

```bash
docker run -d \
  --name minha-api \
  --network rede-desafio \
  -p 3000:3000 \
  -e PORT=3000 \
  -e DB_HOST=db \
  -e DB_PORT=5432 \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  -e DB_NAME=desafio \
  minha-api:1.0
```

Tambem e possivel usar um arquivo de variaveis:

```bash
cp .env.example .env
docker run -d --name minha-api --network rede-desafio -p 3000:3000 --env-file .env minha-api:1.0
```

## Testes

```bash
docker ps
docker logs minha-api
curl http://localhost:3000/
curl http://localhost:3000/health
curl -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title":"Estudar Docker"}'
curl http://localhost:3000/tasks
curl -X PUT http://localhost:3000/tasks/1 -H "Content-Type: application/json" -d '{"done":true}'
curl -X DELETE http://localhost:3000/tasks/1
docker exec minha-api whoami
```

O comando `whoami` deve retornar `node`, confirmando que o container nao roda como root.

## Decisoes tecnicas

- Imagem base oficial `node:22-alpine`, leve e mantida pelo projeto Node.
- `package*.json` e copiado antes do codigo, permitindo reaproveitar o cache da instalacao de dependencias quando apenas o codigo muda.
- `npm ci` instala exatamente as versoes do `package-lock.json`, garantindo build reproduzivel em qualquer maquina.
- Multi-stage build: a imagem final contem somente as dependencias de producao.
- Usuario nao-root (`USER node`) para reduzir riscos de seguranca.
- A API escuta em `0.0.0.0`, necessario para responder fora do container.
- Configuracao do banco e da porta por variaveis de ambiente, sem credenciais dentro da imagem.
- `EXPOSE 3000` documenta a porta; a publicacao real e feita com `-p 3000:3000`.
- Os containers da API e do banco compartilham uma rede Docker, onde o nome `db` funciona como hostname.

## Parar e limpar

```bash
docker stop minha-api db
docker rm minha-api db
docker network rm rede-desafio
docker rmi minha-api:1.0
```
