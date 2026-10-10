const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'postgres',
  connectionTimeoutMillis: 3000
});

let ready = null;

function ensureSchema() {
  if (!ready) {
    ready = pool
      .query(
        `CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          done BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`
      )
      .catch((err) => {
        ready = null;
        throw err;
      });
  }
  return ready;
}

module.exports = { pool, ensureSchema };
