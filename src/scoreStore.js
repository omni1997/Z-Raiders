const db = require('./db');

// Personal scores persisted in Postgres so a player's totals survive
// reconnects and server restarts.

async function getScore(pseudo) {
  const { rows } = await db.query('SELECT zombies_killed, players_killed FROM scores WHERE pseudo = $1', [pseudo]);
  if (!rows[0]) return { zombiesKilled: 0, playersKilled: 0 };
  return { zombiesKilled: rows[0].zombies_killed, playersKilled: rows[0].players_killed };
}

async function saveScore(pseudo, score) {
  await db.query(
    `INSERT INTO scores (pseudo, zombies_killed, players_killed) VALUES ($1, $2, $3)
     ON CONFLICT (pseudo) DO UPDATE SET zombies_killed = $2, players_killed = $3`,
    [pseudo, score.zombiesKilled, score.playersKilled],
  );
}

async function getTopPlayers(n = 3) {
  const { rows } = await db.query(
    `SELECT pseudo, zombies_killed, players_killed FROM scores
     ORDER BY (zombies_killed + players_killed) DESC LIMIT $1`,
    [n],
  );
  return rows.map((r) => ({ pseudo: r.pseudo, zombiesKilled: r.zombies_killed, playersKilled: r.players_killed }));
}

module.exports = { getScore, saveScore, getTopPlayers };
