const fs = require('fs');
const path = require('path');

// Personal scores keyed by pseudo, persisted to disk so a player's totals
// survive reconnects and server restarts.
const FILE = path.join(__dirname, 'data', 'scores.json');

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

function getScore(pseudo) {
  const s = store[pseudo];
  return s ? { ...s } : { zombiesKilled: 0, playersKilled: 0 };
}

function saveScore(pseudo, score) {
  store[pseudo] = { zombiesKilled: score.zombiesKilled, playersKilled: score.playersKilled };
  scheduleSave();
}

function getTopPlayers(n = 3) {
  return Object.entries(store)
    .sort((a, b) => (b[1].zombiesKilled + b[1].playersKilled) - (a[1].zombiesKilled + a[1].playersKilled))
    .slice(0, n)
    .map(([pseudo, score]) => ({ pseudo, ...score }));
}

module.exports = { getScore, saveScore, getTopPlayers };
