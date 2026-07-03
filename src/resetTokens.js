const crypto = require('crypto');

// Short-lived, in-memory reset tokens. Losing them on restart just means the
// player has to request a new reset link, which is an acceptable tradeoff.
const TOKEN_TTL = 60 * 60 * 1000; // 1 hour
const tokens = new Map(); // token → { email, expiresAt }

function createToken(email) {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, { email, expiresAt: Date.now() + TOKEN_TTL });
  return token;
}

function consumeToken(token) {
  const entry = tokens.get(token);
  if (!entry) return null;
  tokens.delete(token);
  if (entry.expiresAt < Date.now()) return null;
  return entry.email;
}

module.exports = { createToken, consumeToken };
