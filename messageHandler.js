const { randomUUID } = require('crypto');
const { clients, projectiles, scores } = require('./state');
const { randomPosition, broadcast } = require('./utils');
const { PROJECTILE_LIFETIME } = require('./config');

function handleMessage(ws, data) {
  const msg = JSON.parse(data);
  const client = clients.get(ws);
  if (!client) return;

  // Pseudo registration
  if (msg.type === 'pseudo') {
    client.pseudo = msg.pseudo;
    scores.set(client.id, { zombiesKilled: 0, playersKilled: 0 });
    ws.send(JSON.stringify({ type: 'confirm', pseudo: client.pseudo }));
    ws.send(JSON.stringify({ type: 'respawn', id: client.id, x: client.x, y: client.y }));
    console.log(`Connected: ${client.pseudo} (${client.id})`);
  }

  // Chat
  if (msg.type === 'chat' && client.pseudo) {
    broadcast({ type: 'chat', pseudo: client.pseudo, color: client.color, message: msg.message });
  }

  // Movement
  if (msg.type === 'move' && client.pseudo) {
    client.x = msg.x;
    client.y = msg.y;
    broadcast({ type: 'move', id: client.id, x: client.x, y: client.y, color: client.color });
  }

  // Shooting
  if (msg.type === 'shoot' && client.pseudo) {
    const idProj = 'p-' + randomUUID();
    const projectile = {
      id: idProj,
      from: client.id,
      x: msg.x,
      y: msg.y,
      angle: msg.angle,
      createdAt: Date.now(),
    };
    projectiles.set(idProj, projectile);
    broadcast({ type: 'projectile', id: projectile.id, from: projectile.from, x: projectile.x, y: projectile.y, angle: projectile.angle });
    setTimeout(() => projectiles.delete(idProj), PROJECTILE_LIFETIME);
  }
}

module.exports = { handleMessage };