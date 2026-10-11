require('dotenv').config();
const { openDb } = require('./db');
const { createApp, seedAdmin } = require('./app');

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.error('Defina JWT_SECRET no .env');
  process.exit(1);
}

const db = openDb(process.env.DB_FILE || 'courses.db');
seedAdmin(db, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);

const app = createApp({ db, jwtSecret, jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h' });
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API em http://localhost:${port}  |  docs: http://localhost:${port}/docs`));
