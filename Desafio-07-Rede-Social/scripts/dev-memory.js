// Sobe a API com MongoDB em memória (para validar sem Mongo instalado).
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connect } = require('../src/db');
const app = require('../src/app');

(async () => {
  const mongo = await MongoMemoryServer.create();
  await connect(mongo.getUri(), 'rede_social');
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`API (Mongo em memória) em http://localhost:${port}`));
})();
