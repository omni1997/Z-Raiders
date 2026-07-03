const { Pool } = require('pg');
const log = require('./logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'zraiders'}`,
});

function query(text, params) {
  return pool.query(text, params);
}

// Retries until Postgres accepts connections — needed because the app
// container can start before the db container is ready to accept queries.
async function waitForDb(retries = 20, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (i === retries - 1) throw err;
      log.info(`Waiting for database... (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function initSchema() {
  await waitForDb();
  await query(`
    CREATE TABLE IF NOT EXISTS accounts (
      email  TEXT PRIMARY KEY,
      salt   TEXT NOT NULL,
      hash   TEXT NOT NULL,
      pseudo TEXT NOT NULL
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS scores (
      pseudo         TEXT PRIMARY KEY,
      zombies_killed INTEGER NOT NULL DEFAULT 0,
      players_killed INTEGER NOT NULL DEFAULT 0
    )
  `);
}

module.exports = { query, initSchema };
