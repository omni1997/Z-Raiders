const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static('public'));

// Connected clients: ws → { id, color, pseudo, x, y }
const clients = new Map();

// Server-side projectiles
const projectiles = new Map();

// Server-side zombies
const zombies = new Map();

// Server-side scores
const scores = new Map(); // playerId → { zombiesKilled: 0, playersKilled: 0 }

// Map and entity parameters
const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;
const PLAYER_RADIUS = 20;
const PROJECTILE_RADIUS = 4;
const PROJECTILE_SPEED = 400;
const PROJECTILE_LIFETIME = 1500;
const ZOMBIE_SPEED = 80;
const ZOMBIE_SPAWN_INTERVAL = 10; // seconds
const ZOMBIE_RADIUS = 18;

// Utils
function getRandomColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}
function randomPosition() {
  return { x: Math.floor(Math.random() * MAP_WIDTH), y: Math.floor(Math.random() * MAP_HEIGHT) };
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
    .map(([playerId, score]) => ({ playerId, ...score }));
}
function getTopPlayers() {
  return [...scores.entries()]
    .sort((a, b) => (b[1].zombiesKilled + b[1].playersKilled) - (a[1].zombiesKilled + a[1].playersKilled))
    .slice(0, 3)
    .map(([playerId, score]) => {
      const client = [...clients.values()].find(c => c.id === playerId);
      return {
        pseudo: client?.pseudo || playerId, // ← utiliser le pseudo ici
        ...score
      };
    });
}
function broadcast(payload) {
  for (const ws of clients.keys()) ws.send(JSON.stringify(payload));
}

// WebSocket connection
wss.on('connection', (ws) => {
  const color = getRandomColor();
  const id = randomUUID();
  const pos = randomPosition();

  clients.set(ws, { id, color, pseudo: null, x: pos.x, y: pos.y });
  ws.send(JSON.stringify({ type: 'init', id, color }));

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    const client = clients.get(ws);
    if (!client) return;

    // Pseudo registration
    if (msg.type === 'pseudo') {
      client.pseudo = msg.pseudo;
      ws.send(JSON.stringify({ type: 'confirm', pseudo: client.pseudo }));

      const spawnPayload = { type: 'respawn', id: client.id, x: client.x, y: client.y };
      ws.send(JSON.stringify(spawnPayload));
      console.log(`Connected: ${client.pseudo} (${client.id})`);
    }

    // Chat
    if (msg.type === 'chat' && client.pseudo) {
      const chatPayload = { type: 'chat', pseudo: client.pseudo, color: client.color, message: msg.message };
      broadcast(chatPayload);
    }

    // Movement
    if (msg.type === 'move' && client.pseudo) {
      client.x = msg.x;
      client.y = msg.y;
      const movePayload = { type: 'move', id: client.id, x: client.x, y: client.y, color: client.color };
      broadcast(movePayload);
    }

    // Shooting
    if (msg.type === 'shoot' && client.pseudo) {
      const idProj = 'p-' + randomUUID();
      const projectile = { id: idProj, from: client.id, x: msg.x, y: msg.y, angle: msg.angle, createdAt: Date.now() };
      projectiles.set(idProj, projectile);

      const projectilePayload = { type: 'projectile', id: projectile.id, from: projectile.from, x: projectile.x, y: projectile.y, angle: projectile.angle };
      broadcast(projectilePayload);

      setTimeout(() => projectiles.delete(idProj), PROJECTILE_LIFETIME);
    }
  });

  ws.on('close', () => { clients.delete(ws); });
});

// Spawn zombies
setInterval(() => {
  const id = 'z-' + randomUUID();
  const pos = randomPosition();
  const zombie = { id, x: pos.x, y: pos.y, targetId: null };
  zombies.set(id, zombie);

  broadcast({ type: 'zombie_spawn', id: zombie.id, x: zombie.x, y: zombie.y });
  console.log(`Zombie spawned: ${id}`);
}, ZOMBIE_SPAWN_INTERVAL * 1000);

// Server tick (60 FPS)
setInterval(() => {
  const now = Date.now();

  // --- Projectiles ---
  for (const [idProj, proj] of projectiles) {
    const vx = Math.cos(proj.angle) * PROJECTILE_SPEED / 60;
    const vy = Math.sin(proj.angle) * PROJECTILE_SPEED / 60;
    proj.x += vx;
    proj.y += vy;

    let collided = false;

    // Player collision
    for (const client of clients.values()) {
      if (client.id === proj.from || !client.pseudo) continue;
      if (distance(proj, client) < PLAYER_RADIUS + PROJECTILE_RADIUS) {
        const killerScore = scores.get(proj.from) || { zombiesKilled: 0, playersKilled: 0 };
        killerScore.playersKilled += 1;
        scores.set(proj.from, killerScore);

        const newPos = randomPosition();
        client.x = newPos.x;
        client.y = newPos.y;

        broadcast({ type: 'score_update', playerId: proj.from, zombiesKilled: killerScore.zombiesKilled, playersKilled: killerScore.playersKilled, topPlayers: getTopPlayers() });
        broadcast({ type: 'respawn', id: client.id, x: client.x, y: client.y });

        collided = true;
        break;
      }
    }
    if (collided) { projectiles.delete(idProj); continue; }

    // Zombie collision
    for (const [zId, zombie] of zombies) {
      if (distance(proj, zombie) < ZOMBIE_RADIUS + PROJECTILE_RADIUS) {
        zombies.delete(zId);

        const killerScore = scores.get(proj.from) || { zombiesKilled: 0, playersKilled: 0 };
        killerScore.zombiesKilled += 1;
        scores.set(proj.from, killerScore);

        broadcast({ type: 'score_update', playerId: proj.from, zombiesKilled: killerScore.zombiesKilled, playersKilled: killerScore.playersKilled, topPlayers: getTopPlayers() });
        broadcast({ type: 'zombie_remove', id: zId });

        collided = true;
        break;
      }
    }
    if (collided) { projectiles.delete(idProj); continue; }

    // Lifetime expiration
    if (now - proj.createdAt > PROJECTILE_LIFETIME) {
      projectiles.delete(idProj);
    }
  }

  // --- Zombies ---
  for (const zombie of zombies.values()) {
    if (!zombie.targetId || ![...clients.values()].find(c => c.id === zombie.targetId)) {
      let closest = null;
      let minDist = Infinity;
      for (const client of clients.values()) {
        if (!client.pseudo) continue;
        const d = distance(zombie, client);
        if (d < minDist) { minDist = d; closest = client.id; }
      }
      zombie.targetId = closest;
    }

    const target = [...clients.values()].find(c => c.id === zombie.targetId);
    if (!target) continue;

    const dx = target.x - zombie.x;
    const dy = target.y - zombie.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len > 0) { zombie.x += (dx/len)*(ZOMBIE_SPEED/60); zombie.y += (dy/len)*(ZOMBIE_SPEED/60); }

    broadcast({ type: 'zombie_move', id: zombie.id, x: zombie.x, y: zombie.y });

    // Collision with player
    for (const client of clients.values()) {
      if (!client.pseudo) continue;
      if (distance(zombie, client) < PLAYER_RADIUS + ZOMBIE_RADIUS) {
        const newPos = randomPosition();
        client.x = newPos.x;
        client.y = newPos.y;
        broadcast({ type: 'respawn', id: client.id, x: client.x, y: client.y });
        console.log(`${client.pseudo} was caught by zombie ${zombie.id}`);
      }
    }
  }

}, 1000 / 60);

// Start server
server.listen(3000, () => console.log('Server listening on http://127.0.0.1:3000'));
