require('dotenv').config();
const app = require('./app');
const { connect, close } = require('./db');

const PORT = process.env.PORT || 3000;

connect(process.env.MONGODB_URI, process.env.MONGODB_DB || 'rede_social')
  .then(() => {
    const server = app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
    const shutdown = () => server.close(async () => { await close(); process.exit(0); });
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  })
  .catch((err) => {
    console.error('Falha ao iniciar:', err.message);
    process.exit(1);
  });
