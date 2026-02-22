const { MAP_WIDTH, MAP_HEIGHT } = require('./config');
const { clients, scores } = require('./state');

function getRandomColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

function randomPosition() {
  return {
    x: Math.floor(Math.random() * MAP_WIDTH),
    y: Math.floor(Math.random() * MAP_HEIGHT),
  };
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getTopPlayers() {
  return [...scores.entries()]
    .sort((a, b) => (b[1].zombiesKilled + b[1].playersKilled) - (a[1].zombiesKilled + a[1].playersKilled))
    .slice(0, 3)
    .map(([playerId, score]) => {
      const client = [...clients.values()].find(c => c.id === playerId);
      return { pseudo: client?.pseudo || playerId, ...score };
    });
}

function broadcast(payload) {
  for (const ws of clients.keys()) ws.send(JSON.stringify(payload));
}

module.exports = { getRandomColor, randomPosition, distance, getTopPlayers, broadcast };