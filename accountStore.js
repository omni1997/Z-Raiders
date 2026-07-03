const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Accounts keyed by email, persisted to disk. Passwords are never stored in
// clear: scrypt with a random per-account salt.
const FILE = path.join(__dirname, 'data', 'accounts.json');

let store;
try {
  store = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch {
  store = {};
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(store));
  }, 1000);
}

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

function getAccount(email) {
  return store[normalizeEmail(email)] || null;
}

function pseudoTaken(pseudo) {
  return Object.values(store).some((acc) => acc.pseudo.toLowerCase() === pseudo.toLowerCase());
}

function createAccount(email, password, pseudo) {
  const key = normalizeEmail(email);
  const { salt, hash } = hashPassword(password);
  store[key] = { email: key, salt, hash, pseudo };
  scheduleSave();
  return store[key];
}

function setPassword(email, password) {
  const key = normalizeEmail(email);
  const account = store[key];
  if (!account) return;
  const { salt, hash } = hashPassword(password);
  account.salt = salt;
  account.hash = hash;
  scheduleSave();
}

function checkLogin(email, password) {
  const account = getAccount(email);
  if (!account) return null;
  return verifyPassword(password, account.salt, account.hash) ? account : null;
}

module.exports = { getAccount, pseudoTaken, createAccount, setPassword, checkLogin, normalizeEmail };
