const crypto = require('crypto');
const db = require('./db');

// Accounts persisted in Postgres. Passwords are never stored in clear:
// scrypt with a random per-account salt.

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function getAccount(email) {
  const { rows } = await db.query('SELECT * FROM accounts WHERE email = $1', [normalizeEmail(email)]);
  return rows[0] || null;
}

async function pseudoTaken(pseudo) {
  const { rows } = await db.query('SELECT 1 FROM accounts WHERE LOWER(pseudo) = LOWER($1)', [pseudo]);
  return rows.length > 0;
}

async function createAccount(email, password, pseudo) {
  const key = normalizeEmail(email);
  const { salt, hash } = hashPassword(password);
  await db.query(
    'INSERT INTO accounts (email, salt, hash, pseudo) VALUES ($1, $2, $3, $4)',
    [key, salt, hash, pseudo],
  );
  return { email: key, salt, hash, pseudo };
}

async function setPassword(email, password) {
  const key = normalizeEmail(email);
  const { salt, hash } = hashPassword(password);
  await db.query('UPDATE accounts SET salt = $1, hash = $2 WHERE email = $3', [salt, hash, key]);
}

async function checkLogin(email, password) {
  const account = await getAccount(email);
  if (!account) return null;
  return verifyPassword(password, account.salt, account.hash) ? account : null;
}

module.exports = { getAccount, pseudoTaken, createAccount, setPassword, checkLogin, normalizeEmail };
